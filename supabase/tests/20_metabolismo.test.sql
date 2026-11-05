-- Objetivos diarios: no se reescriben días pasados y cada usuario ve solo lo suyo.
begin;

create temp table ids as
  select tests.create_user('a@test.local') as a, tests.create_user('b@test.local') as b;
grant select on ids to authenticated;

do $$
declare v_a uuid; v_b uuid; n int; r public.daily_targets; v_today date;
begin
  select a, b into v_a, v_b from ids;

  -- Un objetivo de hace 10 días (cargado como admin, simula el historial).
  insert into public.daily_targets (user_id, effective_date, target_kcal, target_source)
  values (v_a, (now() at time zone 'America/Argentina/Cordoba')::date - 10, 2300, 'auto');

  perform tests.as_user(v_a);
  v_today := public.user_today();
  assert v_today = (now() at time zone 'America/Argentina/Cordoba')::date, 'hoy debe usar la zona del perfil';

  r := public.set_today_target(2100, 'manual', 1755, 'auto', 2720.25, 'auto', 500, 80, 'moderate');
  assert r.effective_date = v_today and r.target_kcal = 2100, 'debe guardar el objetivo de hoy';

  -- Repetir el guardado el mismo día actualiza la misma fila (idempotente).
  r := public.set_today_target(2050, 'manual', 1755, 'auto', 2720.25, 'auto', 500, 80, 'moderate');
  select count(*) into n from public.daily_targets;
  assert n = 2, 'debe haber una fila histórica y una de hoy, hay ' || n;

  -- El día pasado conserva su objetivo.
  assert (public.target_for(v_today - 5)).target_kcal = 2300, 'un día pasado no debe cambiar';
  assert (public.target_for(v_today)).target_kcal = 2050, 'hoy rige el último objetivo';
  assert (public.target_for(v_today - 20)) is null, 'antes del primer objetivo no hay objetivo';

  -- No se puede escribir directamente (solo con la función).
  begin
    insert into public.daily_targets (effective_date, target_kcal, target_source) values (v_today - 3, 1000, 'manual');
    assert false, 'no debe permitirse insertar objetivos directamente';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.daily_targets set target_kcal = 900;
    assert false, 'no debe permitirse editar objetivos directamente';
  exception when insufficient_privilege then null;
  end;

  -- Peso: uno por día.
  insert into public.weight_entries (entry_date, weight_kg) values (v_today, 80.4);
  begin
    insert into public.weight_entries (entry_date, weight_kg) values (v_today, 80.1);
    assert false, 'no debe haber dos pesos el mismo día';
  exception when unique_violation then null;
  end;

  -- Configuración propia.
  insert into public.metabolic_settings (user_id, deficit_kcal) values (v_a, 650);
  begin
    insert into public.metabolic_settings (user_id, deficit_kcal) values (v_a, 1000);
    assert false, 'déficit fuera de las opciones';
  exception when check_violation or unique_violation then null;
  end;

  -- B no ve nada de A.
  perform tests.as_user(v_b);
  select count(*) into n from public.daily_targets; assert n = 0, 'B no debe ver objetivos de A';
  select count(*) into n from public.weight_entries; assert n = 0, 'B no debe ver pesos de A';
  select count(*) into n from public.metabolic_settings; assert n = 0, 'B no debe ver la configuración de A';
  assert (public.target_for(v_today)) is null, 'target_for no debe filtrar datos de A';
  begin
    insert into public.metabolic_settings (user_id, deficit_kcal) values (v_a, 300);
    assert false, 'B no debe poder crear configuración para A';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.weight_entries (user_id, entry_date, weight_kg) values (v_a, v_today - 1, 70);
    assert false, 'B no debe poder cargar pesos para A';
  exception when insufficient_privilege then null;
  end;

  -- anon no puede usar la función.
  perform tests.as_anon();
  begin
    perform public.set_today_target(2000, 'manual', null, null, null, null, null, null, null);
    assert false, 'anon no debe poder guardar objetivos';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
