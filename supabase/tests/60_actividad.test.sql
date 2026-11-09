-- Actividad física: aislamiento por usuario, tipos válidos, idempotencia y borrado lógico.
begin;

create temp table ids as
  select tests.create_user('aa@test.local') as a, tests.create_user('ab@test.local') as b;
grant select on ids to authenticated;

do $$
declare v_a uuid; v_b uuid; v_id uuid; v_op uuid := gen_random_uuid(); n int;
begin
  select a, b into v_a, v_b from ids;

  perform tests.as_user(v_a);
  insert into public.activity_entries (entry_date, kind, distance_km, weight_kg, kcal, operation_id)
    values ('2025-03-10', 'run', 5, 80, 400, v_op) returning id into v_id;
  -- Reintento con el mismo operation_id: no duplica.
  insert into public.activity_entries (entry_date, kind, distance_km, weight_kg, kcal, operation_id)
    values ('2025-03-10', 'run', 5, 80, 400, v_op) on conflict (user_id, operation_id) do nothing;
  select count(*) into n from public.activity_entries;
  assert n = 1, 'la carga es idempotente';

  begin
    insert into public.activity_entries (entry_date, kind, kcal, operation_id) values ('2025-03-10', 'swim', 100, gen_random_uuid());
    assert false, 'solo cuatro tipos';
  exception when check_violation then null;
  end;
  begin
    insert into public.activity_entries (entry_date, kind, kcal, operation_id) values ('2025-03-10', 'run', 100, gen_random_uuid());
    assert false, 'correr requiere km';
  exception when check_violation then null;
  end;
  insert into public.activity_entries (entry_date, kind, kcal, operation_id) values ('2025-03-10', 'gym', 350, gen_random_uuid());

  perform tests.as_admin();
  perform tests.as_user(v_b);
  select count(*) into n from public.activity_entries;
  assert n = 0, 'B no ve la actividad de A';
  update public.activity_entries set deleted_at = now() where id = v_id;
  perform tests.as_admin();
  perform tests.as_user(v_a);
  select count(*) into n from public.activity_entries where deleted_at is null;
  assert n = 2, 'B no puede borrar la actividad de A';

  update public.activity_entries set deleted_at = now() where id = v_id;
  select count(*) into n from public.activity_entries where deleted_at is null;
  assert n = 1, 'borrado lógico propio';
  perform tests.as_admin();
end $$;

rollback;
