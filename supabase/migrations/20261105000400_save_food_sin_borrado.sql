-- save_food sin borrados internos: agrega o actualiza unidades y alias.
-- La app quita después, con RLS, las unidades y alias que el usuario sacó del formulario.
-- (Una función con DELETE no se puede aplicar desde el conector de Supabase sin una
-- confirmación que no llega a la interfaz del usuario.)

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
