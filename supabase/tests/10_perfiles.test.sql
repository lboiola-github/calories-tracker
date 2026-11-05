-- Perfiles: se crean solos y cada usuario ve y edita solo el suyo.
begin;

create temp table ids as
  select tests.create_user('a@test.local') as a, tests.create_user('b@test.local') as b;
grant select on ids to authenticated, anon;

do $$
declare v_a uuid; v_b uuid; n int;
begin
  select a, b into v_a, v_b from ids;

  -- El trigger creó ambos perfiles con la zona horaria por defecto.
  select count(*) into n from public.profiles where id in (v_a, v_b) and timezone = 'America/Argentina/Cordoba';
  assert n = 2, 'el trigger debe crear un perfil por usuario';

  perform tests.as_user(v_a);
  select count(*) into n from public.profiles;
  assert n = 1, 'A debe ver solo su perfil, ve ' || n;

  update public.profiles set height_cm = 180 where id = v_b;
  get diagnostics n = row_count;
  assert n = 0, 'A no debe poder editar el perfil de B';

  update public.profiles set height_cm = 175.5 where id = v_a;
  get diagnostics n = row_count;
  assert n = 1, 'A debe poder editar su perfil';

  begin
    update public.profiles set id = v_b where id = v_a;
    assert false, 'A no debe poder apropiarse del id de B';
  exception when others then null;
  end;

  begin
    delete from public.profiles where id = v_a;
    get diagnostics n = row_count;
    assert n = 0, 'no debe existir borrado directo de perfiles';
  exception when insufficient_privilege then null;
  end;

  perform tests.as_anon();
  begin
    select count(*) into n from public.profiles;
    assert false, 'anon no debe poder leer perfiles';
  exception when insufficient_privilege then null;
  end;

  perform tests.as_admin();
  begin
    update public.profiles set height_cm = 20 where id = v_a;
    assert false, 'la altura fuera de rango debe rechazarse';
  exception when check_violation then null;
  end;
end $$;

rollback;
