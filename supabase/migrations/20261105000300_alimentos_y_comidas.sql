-- Etapa 3: catálogo personal de alimentos, comidas registradas e idempotencia.
--
-- Principios:
--   * Valores nutricionales siempre por 100 g del alimento en el estado indicado (crudo, cocido…).
--   * Cada ítem registrado guarda una copia (snapshot) de los valores aplicados: editar o borrar
--     un alimento nunca altera el historial.
--   * Las escrituras de comidas pasan por funciones que reciben un id de operación generado por el
--     cliente. Repetir la misma operación devuelve el resultado original sin duplicar.

-- Normaliza texto para búsquedas: minúsculas, sin acentos, espacios simples.
create or replace function public.normalize_text(p text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select regexp_replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p, ''))), '\s+', ' ', 'g')
$$;

create type public.meal_type as enum ('breakfast', 'lunch', 'snack', 'dinner', 'other');

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  name_normalized text generated always as (public.normalize_text(name)) stored,
  -- Estado en el que se pesa el alimento. Determina qué referencia corresponde.
  preparation text not null default 'na'
    check (preparation in ('na', 'raw', 'cooked', 'boiled', 'grilled', 'baked', 'roasted', 'fried', 'steamed')),
  brand text check (char_length(brand) <= 80),
  kcal_per_100g numeric(7, 2) not null check (kcal_per_100g between 0 and 950),
  protein_per_100g numeric(6, 2) not null check (protein_per_100g between 0 and 100),
  carbs_per_100g numeric(6, 2) not null check (carbs_per_100g between 0 and 100),
  fat_per_100g numeric(6, 2) not null check (fat_per_100g between 0 and 100),
  fiber_per_100g numeric(6, 2) check (fiber_per_100g between 0 and 100),
  -- Origen de los valores y datos para auditarlos.
  source_type text not null default 'manual' check (source_type in ('manual', 'label', 'usda', 'off', 'other')),
  source_ref text check (char_length(source_ref) <= 200),
  source_detail jsonb,
  validated boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (protein_per_100g + carbs_per_100g + fat_per_100g <= 100.5)
);

create unique index foods_user_name_prep_uniq
  on public.foods (user_id, name_normalized, preparation, coalesce(brand, ''))
  where archived_at is null;
create index foods_user_idx on public.foods (user_id) where archived_at is null;
create index foods_name_trgm_idx on public.foods using gin (name_normalized extensions.gin_trgm_ops);

create trigger foods_set_updated_at before update on public.foods
  for each row execute function public.set_updated_at();

create table public.food_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  alias text not null check (char_length(btrim(alias)) between 1 and 120),
  alias_normalized text generated always as (public.normalize_text(alias)) stored,
  created_at timestamptz not null default now(),
  unique (food_id, alias_normalized)
);

create index food_aliases_trgm_idx on public.food_aliases using gin (alias_normalized extensions.gin_trgm_ops);
create index food_aliases_user_idx on public.food_aliases (user_id);

-- Unidades propias de un alimento: "unidad", "tostada", "cucharada"… con su peso en gramos.
create table public.food_units (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  name_normalized text generated always as (public.normalize_text(name)) stored,
  grams numeric(7, 2) not null check (grams > 0 and grams <= 5000),
  created_at timestamptz not null default now(),
  unique (food_id, name_normalized)
);

create index food_units_user_idx on public.food_units (user_id);

-- Comidas de un día. Hay una por tipo y fecha local del usuario.
create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  meal_date date not null,
  meal_type public.meal_type not null,
  created_at timestamptz not null default now(),
  unique (user_id, meal_date, meal_type)
);

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  meal_id uuid not null references public.meals (id) on delete cascade,
  food_id uuid references public.foods (id) on delete set null,
  -- Cantidad tal como se ingresó y su equivalente en gramos.
  quantity numeric(8, 2) not null check (quantity > 0),
  unit text not null check (char_length(unit) between 1 and 40),
  grams numeric(8, 2) not null check (grams > 0 and grams <= 10000),
  -- Snapshot de lo aplicado en el momento del registro.
  food_name text not null,
  preparation text not null,
  kcal_per_100g numeric(7, 2) not null,
  protein_per_100g numeric(6, 2) not null,
  carbs_per_100g numeric(6, 2) not null,
  fat_per_100g numeric(6, 2) not null,
  fiber_per_100g numeric(6, 2),
  source_type text not null,
  source_ref text,
  kcal numeric(8, 2) not null check (kcal >= 0),
  protein_g numeric(7, 2) not null check (protein_g >= 0),
  carbs_g numeric(7, 2) not null check (carbs_g >= 0),
  fat_g numeric(7, 2) not null check (fat_g >= 0),
  fiber_g numeric(7, 2),
  input_text text check (char_length(input_text) <= 2000),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meal_items_meal_idx on public.meal_items (meal_id) where deleted_at is null;
create index meal_items_user_idx on public.meal_items (user_id);
create index meal_items_food_idx on public.meal_items (food_id);

create trigger meal_items_set_updated_at before update on public.meal_items
  for each row execute function public.set_updated_at();

-- Registro de operaciones para idempotencia (doble toque, reintentos de red).
create table public.operations (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create index operations_user_idx on public.operations (user_id, created_at desc);

-- RLS: todo es propio del usuario.
alter table public.foods enable row level security;
alter table public.food_aliases enable row level security;
alter table public.food_units enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;
alter table public.operations enable row level security;

create policy "alimentos: propios" on public.foods for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Alias y unidades: propios y colgados de un alimento propio.
create policy "alias: propios" on public.food_aliases for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.foods f where f.id = food_id and f.user_id = (select auth.uid()))
  );

create policy "unidades: propias" on public.food_units for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.foods f where f.id = food_id and f.user_id = (select auth.uid()))
  );

-- Comidas e ítems: lectura directa; las escrituras pasan por las funciones de abajo.
create policy "comidas: leer propias" on public.meals for select to authenticated
  using (user_id = (select auth.uid()));
create policy "ítems: leer propios" on public.meal_items for select to authenticated
  using (user_id = (select auth.uid()));
create policy "operaciones: leer propias" on public.operations for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.foods, public.food_aliases, public.food_units, public.meals, public.meal_items, public.operations from anon;
grant select, insert, update, delete on public.foods, public.food_aliases, public.food_units to authenticated;
grant select on public.meals, public.meal_items, public.operations to authenticated;

-- ---------------------------------------------------------------------------
-- Funciones de escritura de comidas (atómicas e idempotentes)
-- ---------------------------------------------------------------------------

-- Devuelve el resultado guardado si la operación ya se hizo; null si es nueva.
create or replace function public._operation_result(p_operation_id uuid, p_user uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select o.result from public.operations o where o.id = p_operation_id and o.user_id = p_user
$$;

create or replace function public._require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'no autenticado' using errcode = '42501'; end if;
  return v;
end;
$$;

create or replace function public._meal_id(p_user uuid, p_date date, p_type public.meal_type)
returns uuid
language plpgsql
set search_path = ''
as $$
declare v_id uuid;
begin
  insert into public.meals (user_id, meal_date, meal_type) values (p_user, p_date, p_type)
  on conflict (user_id, meal_date, meal_type) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.meals where user_id = p_user and meal_date = p_date and meal_type = p_type;
  end if;
  return v_id;
end;
$$;

-- Registra uno o varios ítems en una comida. Todo o nada.
-- p_items: [{food_id, quantity, unit, grams, food_name, preparation, kcal_per_100g, protein_per_100g,
--            carbs_per_100g, fat_per_100g, fiber_per_100g, source_type, source_ref,
--            kcal, protein_g, carbs_g, fat_g, fiber_g}]
-- Los valores los calcula la app con el módulo de nutrición; la base verifica que el alimento
-- sea del usuario y que los totales correspondan a los valores por 100 g.
create or replace function public.log_meal_items(
  p_operation_id uuid,
  p_meal_date date,
  p_meal_type public.meal_type,
  p_items jsonb,
  p_input_text text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public._require_user();
  v_prev jsonb;
  v_meal uuid;
  v_item jsonb;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_result jsonb;
begin
  -- Serializa operaciones con el mismo id (dos solicitudes simultáneas).
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text, 0));
  v_prev := public._operation_result(p_operation_id, v_user);
  if v_prev is not null then return v_prev || jsonb_build_object('replayed', true); end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'sin ítems' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception 'demasiados ítems' using errcode = '22023';
  end if;

  v_meal := public._meal_id(v_user, p_meal_date, p_meal_type);

  for v_item in select * from jsonb_array_elements(p_items) loop
    if v_item ? 'food_id' and v_item->>'food_id' is not null and not exists (
      select 1 from public.foods f where f.id = (v_item->>'food_id')::uuid and f.user_id = v_user
    ) then
      raise exception 'alimento inexistente' using errcode = '23503';
    end if;
    -- Los totales deben corresponder a gramos × valor por 100 g (tolerancia de redondeo).
    if abs((v_item->>'kcal')::numeric - (v_item->>'grams')::numeric * (v_item->>'kcal_per_100g')::numeric / 100) > 0.6 then
      raise exception 'kcal inconsistentes' using errcode = '22023';
    end if;

    insert into public.meal_items (
      user_id, meal_id, food_id, quantity, unit, grams, food_name, preparation,
      kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g,
      source_type, source_ref, kcal, protein_g, carbs_g, fat_g, fiber_g, input_text
    ) values (
      v_user, v_meal, nullif(v_item->>'food_id', '')::uuid,
      (v_item->>'quantity')::numeric, v_item->>'unit', (v_item->>'grams')::numeric,
      v_item->>'food_name', coalesce(v_item->>'preparation', 'na'),
      (v_item->>'kcal_per_100g')::numeric, (v_item->>'protein_per_100g')::numeric,
      (v_item->>'carbs_per_100g')::numeric, (v_item->>'fat_per_100g')::numeric,
      nullif(v_item->>'fiber_per_100g', '')::numeric,
      coalesce(v_item->>'source_type', 'manual'), v_item->>'source_ref',
      (v_item->>'kcal')::numeric, (v_item->>'protein_g')::numeric,
      (v_item->>'carbs_g')::numeric, (v_item->>'fat_g')::numeric,
      nullif(v_item->>'fiber_g', '')::numeric, p_input_text
    ) returning id into v_id;
    v_ids := v_ids || v_id;
  end loop;

  v_result := jsonb_build_object('meal_id', v_meal, 'item_ids', to_jsonb(v_ids), 'replayed', false);
  insert into public.operations (id, user_id, kind, result) values (p_operation_id, v_user, 'log_meal_items', v_result);
  return v_result;
end;
$$;

-- Edita un ítem: cantidad (con su snapshot recalculado por la app) y/o comida y fecha.
create or replace function public.update_meal_item(
  p_operation_id uuid,
  p_item_id uuid,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public._require_user();
  v_prev jsonb;
  v_item public.meal_items;
  v_meal public.meals;
  v_new_meal uuid;
  v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text, 0));
  v_prev := public._operation_result(p_operation_id, v_user);
  if v_prev is not null then return v_prev || jsonb_build_object('replayed', true); end if;

  select * into v_item from public.meal_items where id = p_item_id and user_id = v_user and deleted_at is null for update;
  if not found then raise exception 'ítem inexistente' using errcode = 'P0002'; end if;
  select * into v_meal from public.meals where id = v_item.meal_id;

  v_new_meal := public._meal_id(
    v_user,
    coalesce((p_patch->>'meal_date')::date, v_meal.meal_date),
    coalesce((p_patch->>'meal_type')::public.meal_type, v_meal.meal_type)
  );

  if p_patch ? 'grams' then
    if abs((p_patch->>'kcal')::numeric - (p_patch->>'grams')::numeric * v_item.kcal_per_100g / 100) > 0.6 then
      raise exception 'kcal inconsistentes' using errcode = '22023';
    end if;
    update public.meal_items set
      quantity = (p_patch->>'quantity')::numeric,
      unit = p_patch->>'unit',
      grams = (p_patch->>'grams')::numeric,
      kcal = (p_patch->>'kcal')::numeric,
      protein_g = (p_patch->>'protein_g')::numeric,
      carbs_g = (p_patch->>'carbs_g')::numeric,
      fat_g = (p_patch->>'fat_g')::numeric,
      fiber_g = nullif(p_patch->>'fiber_g', '')::numeric,
      meal_id = v_new_meal
    where id = p_item_id;
  else
    update public.meal_items set meal_id = v_new_meal where id = p_item_id;
  end if;

  v_result := jsonb_build_object('item_id', p_item_id, 'meal_id', v_new_meal, 'replayed', false);
  insert into public.operations (id, user_id, kind, result) values (p_operation_id, v_user, 'update_meal_item', v_result);
  return v_result;
end;
$$;

-- Borrado lógico (se puede deshacer) o restauración de un ítem.
create or replace function public.set_meal_item_deleted(
  p_operation_id uuid,
  p_item_id uuid,
  p_deleted boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public._require_user();
  v_prev jsonb;
  v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text, 0));
  v_prev := public._operation_result(p_operation_id, v_user);
  if v_prev is not null then return v_prev || jsonb_build_object('replayed', true); end if;

  update public.meal_items
    set deleted_at = case when p_deleted then now() else null end
    where id = p_item_id and user_id = v_user;
  if not found then raise exception 'ítem inexistente' using errcode = 'P0002'; end if;

  v_result := jsonb_build_object('item_id', p_item_id, 'deleted', p_deleted, 'replayed', false);
  insert into public.operations (id, user_id, kind, result) values (p_operation_id, v_user, 'set_meal_item_deleted', v_result);
  return v_result;
end;
$$;

-- Búsqueda en el catálogo propio por nombre o alias, tolerante a acentos y errores leves.
create or replace function public.search_foods(p_query text, p_limit integer default 20)
returns table (
  id uuid, name text, preparation text, brand text, kcal_per_100g numeric, protein_per_100g numeric,
  carbs_per_100g numeric, fat_per_100g numeric, validated boolean, matched text, score real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select public.normalize_text(p_query) as t),
  candidates as (
    select f.id, f.name_normalized as matched,
      greatest(extensions.similarity(f.name_normalized, q.t),
               case when f.name_normalized like q.t || '%' then 0.9 when f.name_normalized like '%' || q.t || '%' then 0.6 else 0 end) as score
    from public.foods f, q
    where f.archived_at is null and f.user_id = auth.uid()
    union all
    select a.food_id, a.alias_normalized,
      greatest(extensions.similarity(a.alias_normalized, q.t),
               case when a.alias_normalized like q.t || '%' then 0.9 when a.alias_normalized like '%' || q.t || '%' then 0.6 else 0 end)
    from public.food_aliases a, q
    where a.user_id = auth.uid()
  ),
  best as (
    select distinct on (c.id) c.id, c.matched, c.score from candidates c
    where c.score >= 0.25
    order by c.id, c.score desc
  )
  select f.id, f.name, f.preparation, f.brand, f.kcal_per_100g, f.protein_per_100g, f.carbs_per_100g,
    f.fat_per_100g, f.validated, b.matched, b.score::real
  from best b join public.foods f on f.id = b.id and f.archived_at is null
  order by b.score desc, f.validated desc, f.name
  limit least(greatest(p_limit, 1), 50)
$$;

revoke execute on function public._operation_result(uuid, uuid), public._require_user(), public._meal_id(uuid, date, public.meal_type) from public, anon, authenticated;
revoke execute on function public.log_meal_items(uuid, date, public.meal_type, jsonb, text), public.update_meal_item(uuid, uuid, jsonb), public.set_meal_item_deleted(uuid, uuid, boolean), public.search_foods(text, integer) from public, anon;
grant execute on function public.log_meal_items(uuid, date, public.meal_type, jsonb, text), public.update_meal_item(uuid, uuid, jsonb), public.set_meal_item_deleted(uuid, uuid, boolean), public.search_foods(text, integer), public.normalize_text(text) to authenticated;

-- Crea o actualiza un alimento con sus unidades y alias en una sola transacción.
-- security invoker: las políticas RLS se aplican igual que en un insert/update directo.
create or replace function public.save_food(p_id uuid, p_food jsonb, p_units jsonb, p_aliases jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_unit jsonb;
  v_alias text;
begin
  if v_id is null then
    insert into public.foods (name, preparation, brand, kcal_per_100g, protein_per_100g, carbs_per_100g,
      fat_per_100g, fiber_per_100g, source_type, source_ref, source_detail, validated)
    values (p_food->>'name', coalesce(p_food->>'preparation', 'na'), nullif(p_food->>'brand', ''),
      (p_food->>'kcal_per_100g')::numeric, (p_food->>'protein_per_100g')::numeric,
      (p_food->>'carbs_per_100g')::numeric, (p_food->>'fat_per_100g')::numeric,
      nullif(p_food->>'fiber_per_100g', '')::numeric, coalesce(p_food->>'source_type', 'manual'),
      nullif(p_food->>'source_ref', ''), p_food->'source_detail', coalesce((p_food->>'validated')::boolean, false))
    returning id into v_id;
  else
    update public.foods set
      name = p_food->>'name',
      preparation = coalesce(p_food->>'preparation', 'na'),
      brand = nullif(p_food->>'brand', ''),
      kcal_per_100g = (p_food->>'kcal_per_100g')::numeric,
      protein_per_100g = (p_food->>'protein_per_100g')::numeric,
      carbs_per_100g = (p_food->>'carbs_per_100g')::numeric,
      fat_per_100g = (p_food->>'fat_per_100g')::numeric,
      fiber_per_100g = nullif(p_food->>'fiber_per_100g', '')::numeric,
      source_type = coalesce(p_food->>'source_type', 'manual'),
      source_ref = nullif(p_food->>'source_ref', ''),
      source_detail = coalesce(p_food->'source_detail', source_detail),
      validated = coalesce((p_food->>'validated')::boolean, false)
    where id = v_id;
    if not found then raise exception 'alimento inexistente' using errcode = 'P0002'; end if;
    delete from public.food_units where food_id = v_id;
    delete from public.food_aliases where food_id = v_id;
  end if;

  for v_unit in select * from jsonb_array_elements(coalesce(p_units, '[]')) loop
    insert into public.food_units (food_id, name, grams) values (v_id, v_unit->>'name', (v_unit->>'grams')::numeric)
    on conflict (food_id, name_normalized) do update set grams = excluded.grams;
  end loop;
  for v_alias in select jsonb_array_elements_text(coalesce(p_aliases, '[]')) loop
    insert into public.food_aliases (food_id, alias) values (v_id, v_alias) on conflict do nothing;
  end loop;
  return v_id;
end;
$$;

revoke execute on function public.save_food(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_food(uuid, jsonb, jsonb, jsonb) to authenticated;
