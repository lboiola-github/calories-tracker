-- Recetas: cálculo por peso final, versiones inmutables, idempotencia, aislamiento y protección.
begin;

create temp table ids as
  select tests.create_user('ra@test.local') as a, tests.create_user('rb@test.local') as b;
grant select on ids to authenticated;

do $$
declare
  v_a uuid; v_b uuid; v_arroz uuid; v_pollo uuid; v_op uuid := gen_random_uuid();
  r jsonb; r2 jsonb; r3 jsonb; n int; v_kcal numeric; v_grams numeric; v_food uuid;
begin
  select a, b into v_a, v_b from ids;
  perform tests.as_user(v_a);
  insert into public.foods (name, preparation, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g)
  values ('Arroz', 'raw', 360, 7, 79, 0.6, 1.3) returning id into v_arroz;
  insert into public.foods (name, preparation, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g)
  values ('Pollo', 'raw', 120, 22.5, 0, 2.6) returning id into v_pollo;

  -- 200 g de arroz crudo + 300 g de pollo crudo = 1080 kcal; cocido pesa 900 g, 4 porciones.
  r := public.save_recipe(v_op, null, 'Arroz con pollo', jsonb_build_array(
    jsonb_build_object('food_id', v_arroz, 'quantity', 200, 'unit', 'g', 'grams', 200),
    jsonb_build_object('food_id', v_pollo, 'quantity', 300, 'unit', 'g', 'grams', 300)), 900, 4);
  assert (r->>'version')::int = 1, 'primera versión';
  v_food := (r->>'food_id')::uuid;
  select kcal_per_100g into v_kcal from public.foods where id = v_food;
  assert v_kcal = 120, 'kcal/100 g por peso final debe ser 120, es ' || v_kcal;
  select grams into v_grams from public.food_units where food_id = v_food and name = 'porción';
  assert v_grams = 225, 'porción = 900/4 = 225 g, es ' || v_grams;
  select fiber_per_100g into v_kcal from public.foods where id = v_food;
  assert v_kcal is null, 'la fibra del pollo es desconocida: el total no se inventa';

  -- Reintento: no crea otra versión.
  r2 := public.save_recipe(v_op, null, 'Arroz con pollo', '[]'::jsonb, 1, null);
  assert (r2->>'replayed')::boolean, 'reintento';
  select count(*) into n from public.recipe_versions;
  assert n = 1, 'una sola versión tras el reintento';

  -- Nueva versión sin porciones: v1 queda igual, unidades actualizadas en el lugar.
  r3 := public.save_recipe(gen_random_uuid(), (r->>'recipe_id')::uuid, 'Arroz con pollo', jsonb_build_array(
    jsonb_build_object('food_id', v_arroz, 'grams', 200)), null, null);
  assert (r3->>'version')::int = 2, 'segunda versión';
  assert r3->>'food_id' = r->>'food_id', 'mismo alimento';
  select kcal_per_100g into v_kcal from public.recipe_versions where version = 1;
  assert v_kcal = 120, 'la versión 1 no cambia';
  select grams into v_grams from public.food_units where food_id = v_food and name = 'receta entera';
  assert v_grams = 200, 'receta entera = suma de ingredientes, es ' || v_grams;
  -- La app quita la porción sobrante (permitido); cambiar valores del alimento no.
  delete from public.food_units where food_id = v_food and name = 'porción';
  select count(*) into n from public.food_units where food_id = v_food;
  assert n = 1, 'queda solo receta entera';
  begin
    update public.foods set kcal_per_100g = 1 where id = v_food;
    assert false, 'no se edita el alimento de una receta directo';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.food_units (food_id, name, grams) values (v_food, 'taza', 100);
    assert false, 'no se agregan unidades a mano';
  exception when insufficient_privilege then null;
  end;

  -- Peso final imposible (menos que los macros).
  begin
    perform public.save_recipe(gen_random_uuid(), null, 'Imposible', jsonb_build_array(
      jsonb_build_object('food_id', v_arroz, 'grams', 200)), 50, null);
    assert false, 'peso final imposible';
  exception when invalid_parameter_value then null;
  end;

  -- B no ve ni usa lo de A.
  perform tests.as_admin();
  perform tests.as_user(v_b);
  select count(*) into n from public.recipes;
  assert n = 0, 'B no ve recetas de A';
  begin
    perform public.save_recipe(gen_random_uuid(), null, 'Robo', jsonb_build_array(
      jsonb_build_object('food_id', v_arroz, 'grams', 100)), null, null);
    assert false, 'B no puede usar alimentos de A';
  exception when foreign_key_violation then null;
  end;
  begin
    perform public.save_recipe(gen_random_uuid(), (r->>'recipe_id')::uuid, 'Robo', jsonb_build_array(
      jsonb_build_object('food_id', v_arroz, 'grams', 100)), null, null);
    assert false, 'B no puede versionar recetas de A';
  exception when no_data_found then null;
  end;
  perform tests.as_admin();
end $$;

rollback;
