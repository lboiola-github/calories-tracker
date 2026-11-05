-- Etapa 1: base común, perfiles y aislamiento por usuario.
--
-- Convenciones de todo el esquema:
--   * Toda tabla con datos privados tiene user_id y RLS con user_id = auth.uid().
--   * Las políticas usan (select auth.uid()) para que Postgres lo evalúe una vez por consulta.
--   * Cantidades y nutrientes en numeric (sin errores de punto flotante).

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Actualiza updated_at en cada UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create type public.biological_sex as enum ('female', 'male');
create type public.activity_level as enum ('sedentary', 'low', 'moderate', 'high', 'very_high');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  birth_date date check (birth_date > date '1900-01-01'),
  sex public.biological_sex,
  height_cm numeric(5, 1) check (height_cm between 100 and 250),
  activity_level public.activity_level,
  -- Los límites de cada día se calculan en esta zona, nunca en la del servidor.
  timezone text not null default 'America/Argentina/Cordoba'
    check (timezone ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.sex is 'Sexo usado solo para la ecuación de Mifflin-St Jeor.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "perfil: leer el propio" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "perfil: crear el propio" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));

create policy "perfil: editar el propio" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Sin política de DELETE: el perfil se borra solo al eliminar la cuenta (cascade).

-- Crea el perfil al registrarse un usuario.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- anon no tiene acceso a datos privados.
revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;
