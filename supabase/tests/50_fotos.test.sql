-- Fotos de peso: bucket privado y aislamiento por usuario (tabla y archivos).
begin;

create temp table ids as
  select tests.create_user('fa@test.local') as a, tests.create_user('fb@test.local') as b;
grant select on ids to authenticated;

do $$
declare v_a uuid; v_b uuid; v_entry uuid; v_entry_b uuid; n int; pub boolean;
begin
  select a, b into v_a, v_b from ids;
  select public into pub from storage.buckets where id = 'weight-photos';
  assert pub = false, 'el bucket debe ser privado';

  perform tests.as_user(v_a);
  insert into public.weight_entries (entry_date, weight_kg) values ('2025-03-10', 82.4) returning id into v_entry;
  insert into storage.objects (bucket_id, name) values ('weight-photos', v_a || '/' || v_entry || '/f1.jpg');
  insert into public.weight_photos (entry_id, storage_path) values (v_entry, v_a || '/' || v_entry || '/f1.jpg');

  -- Ruta fuera de la carpeta propia: rechazada en la tabla y en storage.
  begin
    insert into public.weight_photos (entry_id, storage_path) values (v_entry, v_b || '/' || v_entry || '/x.jpg');
    assert false, 'la ruta debe empezar con el usuario y el registro';
  exception when check_violation then null;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('weight-photos', v_b || '/x/x.jpg');
    assert false, 'no se sube a la carpeta de otro usuario';
  exception when insufficient_privilege then null;
  end;

  perform tests.as_admin();
  perform tests.as_user(v_b);
  select count(*) into n from public.weight_photos;
  assert n = 0, 'B no ve fotos de A';
  select count(*) into n from storage.objects where bucket_id = 'weight-photos';
  assert n = 0, 'B no ve archivos de A';
  insert into public.weight_entries (entry_date, weight_kg) values ('2025-03-10', 70) returning id into v_entry_b;
  begin
    insert into public.weight_photos (user_id, entry_id, storage_path) values (v_b, v_entry, v_b || '/' || v_entry || '/y.jpg');
    assert false, 'B no asocia fotos al registro de A';
  exception when insufficient_privilege then null;
  end;

  -- Borrar el registro borra sus filas de fotos.
  perform tests.as_admin();
  perform tests.as_user(v_a);
  delete from public.weight_entries where id = v_entry;
  select count(*) into n from public.weight_photos;
  assert n = 0, 'las fotos del registro se van con él';
  perform tests.as_admin();
end $$;

rollback;
