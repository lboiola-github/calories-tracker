-- Catálogo y comidas: aislamiento, atomicidad, idempotencia y snapshot histórico.
begin;

create temp table ids as
  select tests.create_user('a@test.local') as a, tests.create_user('b@test.local') as b;
grant select on ids to authenticated;

do $$
declare
  v_a uuid; v_b uuid; v_food uuid; v_food_b uuid; v_op uuid := gen_random_uuid();
  r jsonb; r2 jsonb; n int; v_item uuid; v_kcal numeric;
  v_items jsonb;
begin
  select a, b into v_a, v_b from ids;

  -- A crea un alimento (pollo cocido) con alias y unidad.
  perform tests.as_user(v_a);
  insert into public.foods (name, preparation, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, validated)
  values ('Pechuga de pollo', 'cooked', 165, 31, 0, 3.6, true) returning id into v_food;
  insert into public.food_aliases (food_id, alias) values (v_food, 'pechu');
  insert into public.food_units (food_id, name, grams) values (v_food, 'porción', 150);

  -- Mismo nombre y estado: duplicado rechazado. Distinto estado (crudo): permitido.
  begin
    insert into public.foods (name, preparation, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g)
    values ('pechuga de POLLO', 'cooked', 160, 30, 0, 3);
    assert false, 'no debe duplicar nombre + estado';
  exception when unique_violation then null;
  end;
  insert into public.foods (name, preparation, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g)
  values ('Pechuga de pollo', 'raw', 120, 22.5, 0, 2.6);

  -- Macros imposibles (más de 100 g por 100 g).
  begin
    insert into public.foods (name, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g)
    values ('Imposible', 500, 60, 50, 10);
    assert false, 'macros > 100 g deben rechazarse';
  exception when check_violation then null;
  end;

  -- Búsqueda sin acentos y por alias.
  select count(*) into n from public.search_foods('pechu');
  assert n >= 1, 'debe encontrar por alias';
  select count(*) into n from public.search_foods('POLLO');
  assert n = 2, 'debe encontrar crudo y cocido, encontró ' || n;

  -- Registrar 230 g de pollo cocido: 379,5 kcal.
  v_items := jsonb_build_array(jsonb_build_object(
    'food_id', v_food, 'quantity', 230, 'unit', 'g', 'grams', 230, 'food_name', 'Pechuga de pollo',
    'preparation', 'cooked', 'kcal_per_100g', 165, 'protein_per_100g', 31, 'carbs_per_100g', 0,
    'fat_per_100g', 3.6, 'source_type', 'manual', 'kcal', 379.5, 'protein_g', 71.3, 'carbs_g', 0, 'fat_g', 8.28));
  r := public.log_meal_items(v_op, '2025-03-10', 'lunch', v_items, 'almorcé 230 g de pollo');
  assert (r->>'replayed')::boolean = false, 'primera vez no es repetición';

  -- Reintento con el mismo id: no duplica.
  r2 := public.log_meal_items(v_op, '2025-03-10', 'lunch', v_items, 'almorcé 230 g de pollo');
  assert (r2->>'replayed')::boolean = true, 'el reintento debe marcarse como repetido';
  assert r2->'item_ids' = r->'item_ids', 'el reintento devuelve los mismos ítems';
  select count(*) into n from public.meal_items where deleted_at is null;
  assert n = 1, 'debe haber un solo ítem, hay ' || n;

  -- Atomicidad: un ítem inválido cancela todo el registro.
  begin
    perform public.log_meal_items(gen_random_uuid(), '2025-03-10', 'dinner',
      v_items || jsonb_build_array(v_items->0 || jsonb_build_object('kcal', 999)));
    assert false, 'kcal inconsistentes deben rechazarse';
  exception when invalid_parameter_value then null;
  end;
  select count(*) into n from public.meals where meal_type = 'dinner';
  assert n = 0, 'no debe quedar la cena a medias';
  select count(*) into n from public.meal_items;
  assert n = 1, 'no debe quedar ningún ítem del registro fallido';

  -- Snapshot: editar el alimento no altera lo registrado.
  update public.foods set kcal_per_100g = 200 where id = v_food;
  select kcal into v_kcal from public.meal_items limit 1;
  assert v_kcal = 379.5, 'el historial debe conservar los valores aplicados';

  -- Borrar el alimento tampoco borra el historial.
  delete from public.foods where id = v_food;
  select count(*) into n from public.meal_items where food_id is null and food_name = 'Pechuga de pollo';
  assert n = 1, 'el ítem queda con su snapshot aunque se borre el alimento';

  -- Editar cantidad y mover de comida, de forma idempotente.
  select (r->'item_ids'->>0)::uuid into v_item;
  v_op := gen_random_uuid();
  r := public.update_meal_item(v_op, v_item, jsonb_build_object(
    'quantity', 180, 'unit', 'g', 'grams', 180, 'kcal', 297, 'protein_g', 55.8, 'carbs_g', 0, 'fat_g', 6.48,
    'meal_type', 'dinner'));
  r2 := public.update_meal_item(v_op, v_item, jsonb_build_object('grams', 1, 'kcal', 1));
  assert (r2->>'replayed')::boolean, 'la edición repetida no se reaplica';
  select grams, kcal into v_kcal, v_kcal from public.meal_items where id = v_item;
  assert v_kcal = 297, 'la edición debe guardar 297 kcal';
  select count(*) into n from public.meal_items i join public.meals m on m.id = i.meal_id where m.meal_type = 'dinner';
  assert n = 1, 'el ítem debe pasar a la cena';

  -- Borrado lógico y deshacer.
  perform public.set_meal_item_deleted(gen_random_uuid(), v_item, true);
  select count(*) into n from public.meal_items where deleted_at is null;
  assert n = 0, 'el ítem debe quedar borrado';
  perform public.set_meal_item_deleted(gen_random_uuid(), v_item, false);
  select count(*) into n from public.meal_items where deleted_at is null;
  assert n = 1, 'deshacer debe restaurarlo';

  -- No se puede escribir comidas directamente.
  begin
    insert into public.meal_items (meal_id, quantity, unit, grams, food_name, preparation, kcal_per_100g,
      protein_per_100g, carbs_per_100g, fat_per_100g, source_type, kcal, protein_g, carbs_g, fat_g)
    select id, 1, 'g', 1, 'x', 'na', 0, 0, 0, 0, 'manual', 0, 0, 0, 0 from public.meals limit 1;
    assert false, 'las escrituras directas de ítems deben estar bloqueadas';
  exception when insufficient_privilege then null;
  end;

  -- B: no ve nada de A ni puede usar sus alimentos o ítems.
  perform tests.as_user(v_b);
  select count(*) into n from public.foods; assert n = 0, 'B no ve alimentos de A';
  select count(*) into n from public.food_aliases; assert n = 0, 'B no ve alias de A';
  select count(*) into n from public.meals; assert n = 0, 'B no ve comidas de A';
  select count(*) into n from public.meal_items; assert n = 0, 'B no ve ítems de A';
  select count(*) into n from public.operations; assert n = 0, 'B no ve operaciones de A';
  select count(*) into n from public.search_foods('pollo'); assert n = 0, 'la búsqueda no filtra datos de A';

  begin
    perform public.set_meal_item_deleted(gen_random_uuid(), v_item, true);
    assert false, 'B no debe poder borrar ítems de A';
  exception when no_data_found then null;
  end;
  begin
    perform public.update_meal_item(gen_random_uuid(), v_item, '{"meal_type":"breakfast"}');
    assert false, 'B no debe poder editar ítems de A';
  exception when no_data_found then null;
  end;

  -- B no puede colgar un alias de un alimento de A.
  perform tests.as_admin();
  select id into v_food_b from public.foods where user_id = v_a limit 1;
  perform tests.as_user(v_b);
  begin
    insert into public.food_aliases (food_id, alias) values (v_food_b, 'robado');
    assert false, 'B no debe poder agregar alias a un alimento de A';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.log_meal_items(gen_random_uuid(), '2025-03-10', 'lunch',
      jsonb_set(v_items, '{0,food_id}', to_jsonb(v_food_b)));
    assert false, 'B no debe poder registrar alimentos de A';
  exception when foreign_key_violation then null;
  end;

  -- B reusa el id de operación de A: no obtiene el resultado de A.
  select id into v_op from public.operations limit 1; -- B no ve ninguno
  assert v_op is null, 'B no ve ids de operación ajenos';
end $$;

rollback;

-- save_food: atómica y sujeta a RLS.
begin;
create temp table ids2 as select tests.create_user('c@test.local') as c, tests.create_user('d@test.local') as d;
grant select on ids2 to authenticated;
do $$
declare v_c uuid; v_d uuid; v_id uuid; n int;
begin
  select c, d into v_c, v_d from ids2;
  perform tests.as_user(v_c);
  v_id := public.save_food(null,
    '{"name":"Huevo","preparation":"boiled","kcal_per_100g":155,"protein_per_100g":12.6,"carbs_per_100g":1.1,"fat_per_100g":10.6,"validated":true}',
    '[{"name":"unidad","grams":50}]', '["huevo duro"]');
  select count(*) into n from public.food_units where food_id = v_id; assert n = 1, 'unidad creada';

  -- Una unidad inválida cancela todo (no queda el alimento a medias).
  begin
    perform public.save_food(null,
      '{"name":"Tostada","kcal_per_100g":300,"protein_per_100g":10,"carbs_per_100g":60,"fat_per_100g":3}',
      '[{"name":"unidad","grams":-1}]', '[]');
    assert false, 'unidad con gramos negativos debe fallar';
  exception when check_violation then null;
  end;
  select count(*) into n from public.foods where name = 'Tostada'; assert n = 0, 'no debe quedar el alimento';

  -- Actualizar reemplaza unidades y alias.
  perform public.save_food(v_id,
    '{"name":"Huevo","preparation":"boiled","kcal_per_100g":155,"protein_per_100g":12.6,"carbs_per_100g":1.1,"fat_per_100g":10.6,"validated":true}',
    '[{"name":"unidad grande","grams":60}]', '[]');
  select count(*) into n from public.food_units where food_id = v_id; assert n = 1, 'reemplazo de unidades';
  select count(*) into n from public.food_aliases where food_id = v_id; assert n = 0, 'reemplazo de alias';

  -- D no puede editar el alimento de C.
  perform tests.as_user(v_d);
  begin
    perform public.save_food(v_id,
      '{"name":"Robado","kcal_per_100g":1,"protein_per_100g":0,"carbs_per_100g":0,"fat_per_100g":0}', '[]', '[]');
    assert false, 'D no debe editar alimentos de C';
  exception when no_data_found then null;
  end;
end $$;
rollback;
