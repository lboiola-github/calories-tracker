-- Etapa 8: fotos privadas asociadas a un registro de peso.
--   * Bucket privado: nunca hay URLs públicas. La app muestra las fotos con URLs firmadas
--     de corta duración, generadas en el servidor para el dueño.
--   * Cada archivo vive en "<user_id>/<entry_id>/<archivo>"; las políticas solo dejan tocar
--     la carpeta propia.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('weight-photos', 'weight-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "fotos de peso: leer propias" on storage.objects for select to authenticated
  using (bucket_id = 'weight-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fotos de peso: subir propias" on storage.objects for insert to authenticated
  with check (bucket_id = 'weight-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fotos de peso: quitar propias" on storage.objects for delete to authenticated
  using (bucket_id = 'weight-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create table public.weight_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_id uuid not null references public.weight_entries (id) on delete cascade,
  storage_path text not null unique check (storage_path like user_id::text || '/' || entry_id::text || '/%'),
  created_at timestamptz not null default now()
);
create index weight_photos_entry_idx on public.weight_photos (entry_id);

alter table public.weight_photos enable row level security;
create policy "fotos: propias" on public.weight_photos for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.weight_entries e where e.id = entry_id and e.user_id = (select auth.uid()))
  );
revoke all on public.weight_photos from anon;
grant select, insert, delete on public.weight_photos to authenticated;
