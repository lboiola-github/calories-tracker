-- Etapa 5: recetas con versiones inmutables.
--
-- Una receta es una lista de ingredientes (alimentos del catálogo, en gramos) más el peso final
-- de la preparación y, opcionalmente, en cuántas porciones se divide.
--   * Cada guardado crea una versión nueva; las versiones no se modifican ni se borran.
--   * La base calcula los totales desde los valores por 100 g de cada ingrediente en ese momento
--     y los guarda como snapshot en la versión.
--   * Cada receta tiene un alimento asociado (source_type 'recipe') con los valores por 100 g de
--     la última versión. Se registra como cualquier alimento: el ítem de comida guarda su propio
--     snapshot, así que editar la receta nunca altera el historial.

alter table public.foods drop constraint foods_source_type_check;
alter table public.foods add constraint foods_source_type_check
  check (source_type in ('manual', 'label', 'usda', 'off', 'other', 'recipe'));

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  food_id uuid unique references public.foods (id) on delete set null,
  current_version integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipes_user_idx on public.recipes (user_id) where archived_at is null;
create trigger recipes_set_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

alter table public.foods add column recipe_id uuid references public.recipes (id) on delete set null;
create unique index foods_recipe_uniq on public.foods (recipe_id) where recipe_id is not null;

create table public.recipe_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  version integer not null check (version > 0),
  name text not null,
  -- Peso de la preparación terminada (cocida). Si no se indica, es la suma de los ingredientes.
  final_weight_g numeric(8, 2) not null check (final_weight_g > 0 and final_weight_g <= 50000),
  final_weight_measured boolean not null,
  portions numeric(5, 2) check (portions > 0 and portions <= 100),
  ingredients_weight_g numeric(9, 2) not null,
  total_kcal numeric(9, 2) not null,
  total_protein_g numeric(8, 2) not null,
  total_carbs_g numeric(8, 2) not null,
  total_fat_g numeric(8, 2) not null,
  total_fiber_g numeric(8, 2),
  kcal_per_100g numeric(7, 2) not null,
  protein_per_100g numeric(6, 2) not null,
  carbs_per_100g numeric(6, 2) not null,
  fat_per_100g numeric(6, 2) not null,
  fiber_per_100g numeric(6, 2),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  unique (recipe_id, version)
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  version_id uuid not null references public.recipe_versions (id) on delete cascade,
  position integer not null,
  food_id uuid references public.foods (id) on delete set null,
  quantity numeric(9, 2) not null check (quantity > 0),
  unit text not null,
  grams numeric(9, 2) not null check (grams > 0 and grams <= 20000),
  food_name text not null,
  preparation text not null,
  kcal_per_100g numeric(7, 2) not null,
  protein_per_100g numeric(6, 2) not null,
  carbs_per_100g numeric(6, 2) not null,
  fat_per_100g numeric(6, 2) not null,
  fiber_per_100g numeric(6, 2),
  kcal numeric(9, 2) not null,
  protein_g numeric(8, 2) not null,
  carbs_g numeric(8, 2) not null,
  fat_g numeric(8, 2) not null,
  fiber_g numeric(8, 2),
  unique (version_id, position)
);
create index recipe_ingredients_version_idx on public.recipe_ingredients (version_id);

alter table public.recipes enable row level security;
alter table public.recipe_versions enable row level security;
alter table public.recipe_ingredients enable row level security;

-- Lectura directa; todas las escrituras pasan por save_recipe / set_recipe_archived.
create policy "recetas: leer propias" on public.recipes for select to authenticated
  using (user_id = (select auth.uid()));
create policy "versiones: leer propias" on public.recipe_versions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "ingredientes: leer propios" on public.recipe_ingredients for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.recipes, public.recipe_versions, public.recipe_ingredients from anon, authenticated;
grant select on public.recipes, public.recipe_versions, public.recipe_ingredients to authenticated;

-- El alimento de una receta solo cambia a través de la receta.
create or replace function public._guard_recipe_food()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('app.recipe_write', true) = 'on' then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' then
    if new.recipe_id is not null or new.source_type = 'recipe' then
      raise exception 'los alimentos de receta se crean desde la receta' using errcode = '42501';
    end if;
    return new;
  end if;
  if old.recipe_id is not null or old.source_type = 'recipe' then
    if tg_op = 'DELETE' then
      raise exception 'archivá la receta en lugar de borrar su alimento' using errcode = '42501';
    end if;
    raise exception 'editá la receta para cambiar este alimento' using errcode = '42501';
  end if;
  -- Un trigger BEFORE DELETE que devuelve null cancela el borrado: devolver old.
  if tg_op = 'DELETE' then return old; end if;
  if new.recipe_id is not null or new.source_type = 'recipe' then
    raise exception 'los alimentos de receta se crean desde la receta' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger foods_guard_recipe before insert or update or delete on public.foods
  for each row execute function public._guard_recipe_food();

create or replace function public._guard_recipe_food_children()
returns trigger
language plpgsql
set search_path = ''
as $$
declare v_food uuid := coalesce(new.food_id, old.food_id);
begin
  -- Quitar una unidad no altera los valores de la receta; la app quita así la "porción" sobrante.
  if tg_op = 'DELETE' or current_setting('app.recipe_write', true) = 'on' then
    return coalesce(new, old);
  end if;
  if exists (select 1 from public.foods f where f.id = v_food and f.recipe_id is not null) then
    raise exception 'editá la receta para cambiar sus unidades' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger food_units_guard_recipe before insert or update or delete on public.food_units
  for each row execute function public._guard_recipe_food_children();

-- Guarda una receta (nueva o como nueva versión). Idempotente por p_operation_id. Todo o nada.
-- p_ingredients: [{food_id, quantity, unit, grams}] — los valores nutricionales se toman del
-- catálogo del usuario dentro de esta transacción; el cliente no los envía.
-- p_final_weight_g: peso de la preparación terminada; null = suma de ingredientes.
create or replace function public.save_recipe(
  p_operation_id uuid,
  p_recipe_id uuid,
  p_name text,
  p_ingredients jsonb,
  p_final_weight_g numeric,
  p_portions numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public._require_user();
  v_prev jsonb;
  v_recipe public.recipes;
  v_version_id uuid;
  v_version integer;
  v_ing jsonb;
  v_food public.foods;
  v_pos integer := 0;
  v_grams numeric;
  v_sum_g numeric := 0;
  v_kcal numeric := 0; v_p numeric := 0; v_c numeric := 0; v_f numeric := 0; v_fib numeric := 0;
  v_fiber_known boolean := true;
  v_final numeric;
  v_food_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_result jsonb;
begin
  if p_operation_id is null then raise exception 'falta el id de operación' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text, 0));
  v_prev := public._operation_result(p_operation_id, v_user);
  if v_prev is not null then return v_prev || jsonb_build_object('replayed', true); end if;

  if char_length(v_name) not between 1 and 120 then
    raise exception 'nombre inválido' using errcode = '22023';
  end if;
  if jsonb_typeof(p_ingredients) <> 'array' or jsonb_array_length(p_ingredients) not between 1 and 60 then
    raise exception 'la receta necesita entre 1 y 60 ingredientes' using errcode = '22023';
  end if;

  if p_recipe_id is null then
    insert into public.recipes (user_id, name) values (v_user, v_name) returning * into v_recipe;
  else
    select * into v_recipe from public.recipes
      where id = p_recipe_id and user_id = v_user and archived_at is null for update;
    if not found then raise exception 'receta inexistente' using errcode = 'P0002'; end if;
    update public.recipes set name = v_name where id = v_recipe.id;
  end if;
  v_version := v_recipe.current_version + 1;

  insert into public.recipe_versions (user_id, recipe_id, version, name, final_weight_g, final_weight_measured,
    portions, ingredients_weight_g, total_kcal, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g,
    kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, notes)
  values (v_user, v_recipe.id, v_version, v_name, 1, false, p_portions, 0, 0, 0, 0, 0, null, 0, 0, 0, 0, null,
    nullif(btrim(coalesce(p_notes, '')), ''))
  returning id into v_version_id;

  for v_ing in select * from jsonb_array_elements(p_ingredients) loop
    v_pos := v_pos + 1;
    select * into v_food from public.foods
      where id = (v_ing->>'food_id')::uuid and user_id = v_user;
    if not found then raise exception 'ingrediente inexistente' using errcode = '23503'; end if;
    if v_food.recipe_id = v_recipe.id then
      raise exception 'una receta no puede contenerse a sí misma' using errcode = '22023';
    end if;
    v_grams := (v_ing->>'grams')::numeric;
    if v_grams is null or v_grams <= 0 or v_grams > 20000 then
      raise exception 'gramos inválidos' using errcode = '22023';
    end if;

    insert into public.recipe_ingredients (user_id, version_id, position, food_id, quantity, unit, grams, food_name,
      preparation, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g,
      kcal, protein_g, carbs_g, fat_g, fiber_g)
    values (v_user, v_version_id, v_pos, v_food.id, coalesce((v_ing->>'quantity')::numeric, v_grams),
      coalesce(nullif(v_ing->>'unit', ''), 'g'), v_grams,
      case when v_food.brand is null then v_food.name else v_food.name || ' (' || v_food.brand || ')' end,
      v_food.preparation, v_food.kcal_per_100g, v_food.protein_per_100g, v_food.carbs_per_100g,
      v_food.fat_per_100g, v_food.fiber_per_100g,
      round(v_food.kcal_per_100g * v_grams / 100, 2), round(v_food.protein_per_100g * v_grams / 100, 2),
      round(v_food.carbs_per_100g * v_grams / 100, 2), round(v_food.fat_per_100g * v_grams / 100, 2),
      round(v_food.fiber_per_100g * v_grams / 100, 2));

    v_sum_g := v_sum_g + v_grams;
    v_kcal := v_kcal + v_food.kcal_per_100g * v_grams / 100;
    v_p := v_p + v_food.protein_per_100g * v_grams / 100;
    v_c := v_c + v_food.carbs_per_100g * v_grams / 100;
    v_f := v_f + v_food.fat_per_100g * v_grams / 100;
    if v_food.fiber_per_100g is null then v_fiber_known := false;
    else v_fib := v_fib + v_food.fiber_per_100g * v_grams / 100; end if;
  end loop;

  v_final := coalesce(p_final_weight_g, v_sum_g);
  if v_final <= 0 or v_final > 50000 then raise exception 'peso final inválido' using errcode = '22023'; end if;
  -- Una cocción no puede concentrar más de 100 g de macros en 100 g de preparación.
  if (v_p + v_c + v_f) * 100 / v_final > 100.5 then
    raise exception 'el peso final es menor que el de los nutrientes: revisá el peso' using errcode = '22023';
  end if;

  update public.recipe_versions set
    final_weight_g = v_final,
    final_weight_measured = p_final_weight_g is not null,
    ingredients_weight_g = v_sum_g,
    total_kcal = round(v_kcal, 2), total_protein_g = round(v_p, 2), total_carbs_g = round(v_c, 2),
    total_fat_g = round(v_f, 2), total_fiber_g = case when v_fiber_known then round(v_fib, 2) end,
    kcal_per_100g = round(v_kcal * 100 / v_final, 2), protein_per_100g = round(v_p * 100 / v_final, 2),
    carbs_per_100g = round(v_c * 100 / v_final, 2), fat_per_100g = round(v_f * 100 / v_final, 2),
    fiber_per_100g = case when v_fiber_known then round(v_fib * 100 / v_final, 2) end
  where id = v_version_id;

  -- Alimento asociado con los valores de la última versión.
  perform set_config('app.recipe_write', 'on', true);
  if v_recipe.food_id is null then
    insert into public.foods (user_id, name, preparation, kcal_per_100g, protein_per_100g, carbs_per_100g,
      fat_per_100g, fiber_per_100g, source_type, source_ref, validated, recipe_id)
    select v_user, v_name, 'na', kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g,
      'recipe', v.id::text, true, v_recipe.id
    from public.recipe_versions v where v.id = v_version_id
    returning id into v_food_id;
  else
    v_food_id := v_recipe.food_id;
    update public.foods f set
      name = v_name, kcal_per_100g = v.kcal_per_100g, protein_per_100g = v.protein_per_100g,
      carbs_per_100g = v.carbs_per_100g, fat_per_100g = v.fat_per_100g, fiber_per_100g = v.fiber_per_100g,
      source_ref = v.id::text, archived_at = null
    from public.recipe_versions v where v.id = v_version_id and f.id = v_food_id;
  end if;

  -- Unidades: se actualizan en el lugar. Si la versión no tiene porciones, la app quita
  -- después la unidad "porción" (quitar una unidad no cambia los valores de la receta).
  insert into public.food_units (user_id, food_id, name, grams) values (v_user, v_food_id, 'receta entera', v_final)
    on conflict (food_id, name_normalized) do update set grams = excluded.grams;
  if p_portions is not null then
    insert into public.food_units (user_id, food_id, name, grams)
    values (v_user, v_food_id, 'porción', round(v_final / p_portions, 2))
    on conflict (food_id, name_normalized) do update set grams = excluded.grams;
  end if;
  perform set_config('app.recipe_write', 'off', true);

  update public.recipes set food_id = v_food_id, current_version = v_version where id = v_recipe.id;

  v_result := jsonb_build_object('recipe_id', v_recipe.id, 'version_id', v_version_id, 'version', v_version,
    'food_id', v_food_id);
  insert into public.operations (id, user_id, kind, result) values (p_operation_id, v_user, 'save_recipe', v_result);
  return v_result || jsonb_build_object('replayed', false);
end;
$$;

-- Archivar (o restaurar) una receta. Su alimento deja de aparecer en búsquedas; el historial queda.
create or replace function public.set_recipe_archived(p_recipe_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid := public._require_user(); v_food uuid;
begin
  update public.recipes set archived_at = case when p_archived then now() end
    where id = p_recipe_id and user_id = v_user
    returning food_id into v_food;
  if not found then raise exception 'receta inexistente' using errcode = 'P0002'; end if;
  perform set_config('app.recipe_write', 'on', true);
  update public.foods set archived_at = case when p_archived then now() end where id = v_food and user_id = v_user;
  perform set_config('app.recipe_write', 'off', true);
end;
$$;

revoke execute on function public.save_recipe(uuid, uuid, text, jsonb, numeric, numeric, text) from public, anon;
revoke execute on function public.set_recipe_archived(uuid, boolean) from public, anon;
grant execute on function public.save_recipe(uuid, uuid, text, jsonb, numeric, numeric, text) to authenticated;
grant execute on function public.set_recipe_archived(uuid, boolean) to authenticated;
revoke execute on function public._guard_recipe_food() from public, anon, authenticated;
revoke execute on function public._guard_recipe_food_children() from public, anon, authenticated;
