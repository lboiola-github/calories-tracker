-- Actividad física: calorías quemadas que se suman al margen del día.
--   * Solo cuatro tipos. Caminar y correr guardan km y el peso usado (la fórmula se aplica
--     en la app y queda como foto histórica en kcal); gimnasio y fútbol, kcal a mano.
--   * operation_id hace idempotente la carga (reintentos no duplican).
--   * Se borra con deleted_at (sin borrado físico).

create table public.activity_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  kind text not null check (kind in ('walk', 'run', 'gym', 'football')),
  distance_km numeric(6, 2) check (distance_km is null or (distance_km > 0 and distance_km <= 200)),
  weight_kg numeric(5, 2) check (weight_kg is null or (weight_kg >= 20 and weight_kg <= 400)),
  kcal numeric(7, 1) not null check (kcal > 0 and kcal <= 10000),
  operation_id uuid not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, operation_id),
  check ((kind in ('walk', 'run')) = (distance_km is not null))
);
create index activity_entries_day_idx on public.activity_entries (user_id, entry_date) where deleted_at is null;

alter table public.activity_entries enable row level security;
create policy "actividad: propia" on public.activity_entries for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
revoke all on public.activity_entries from anon;
grant select, insert, update on public.activity_entries to authenticated;
