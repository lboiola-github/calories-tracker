-- Etapa 2: configuración metabólica, registros de peso e historial de objetivos diarios.
--
-- Los cálculos (Mifflin-St Jeor, TDEE, déficit) se hacen en TypeScript, en un solo módulo
-- con pruebas. La base guarda las entradas, los valores manuales y el objetivo vigente por día.

create table public.metabolic_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  deficit_kcal integer not null default 500 check (deficit_kcal in (300, 500, 650, 800)),
  -- null = usar el valor calculado automáticamente.
  bmr_manual numeric(6, 1) check (bmr_manual between 500 and 5000),
  tdee_manual numeric(6, 1) check (tdee_manual between 800 and 8000),
  target_manual integer check (target_manual between 800 and 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger metabolic_settings_set_updated_at
  before update on public.metabolic_settings
  for each row execute function public.set_updated_at();

create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  weight_kg numeric(5, 2) not null check (weight_kg between 20 and 400),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Como máximo un peso por día: cargar otro el mismo día lo reemplaza.
  unique (user_id, entry_date)
);

create index weight_entries_user_date_idx on public.weight_entries (user_id, entry_date desc);

create trigger weight_entries_set_updated_at
  before update on public.weight_entries
  for each row execute function public.set_updated_at();

-- Objetivo vigente desde una fecha. El objetivo de un día D es la fila más reciente con
-- effective_date <= D. Cambiar la configuración escribe solo la fila de "hoy" (en la zona del
-- usuario), así los días anteriores nunca se recalculan.
create table public.daily_targets (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  effective_date date not null,
  target_kcal integer not null check (target_kcal between 800 and 8000),
  target_source text not null check (target_source in ('auto', 'manual')),
  bmr_kcal numeric(6, 1),
  bmr_source text check (bmr_source in ('auto', 'manual')),
  tdee_kcal numeric(6, 1),
  tdee_source text check (tdee_source in ('auto', 'manual')),
  deficit_kcal integer,
  weight_kg numeric(5, 2),
  activity_level public.activity_level,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, effective_date)
);

create trigger daily_targets_set_updated_at
  before update on public.daily_targets
  for each row execute function public.set_updated_at();

-- RLS
alter table public.metabolic_settings enable row level security;
alter table public.weight_entries enable row level security;
alter table public.daily_targets enable row level security;

create policy "metabólica: propia" on public.metabolic_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "peso: propio" on public.weight_entries
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Objetivos: solo lectura directa. Se escriben con set_today_target().
create policy "objetivos: leer propios" on public.daily_targets
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.metabolic_settings, public.weight_entries, public.daily_targets from anon;
grant select, insert, update, delete on public.metabolic_settings, public.weight_entries to authenticated;
grant select on public.daily_targets to authenticated;

-- Fecha local de hoy del usuario actual, según la zona horaria de su perfil.
create or replace function public.user_today()
returns date
language sql
stable
security invoker
set search_path = ''
as $$
  select (now() at time zone coalesce(
    (select p.timezone from public.profiles p where p.id = auth.uid()),
    'America/Argentina/Cordoba'
  ))::date
$$;

-- Guarda el objetivo vigente desde hoy. La fecha la decide la base, no el cliente:
-- no se puede reescribir el objetivo de un día pasado.
create or replace function public.set_today_target(
  p_target_kcal integer,
  p_target_source text,
  p_bmr_kcal numeric,
  p_bmr_source text,
  p_tdee_kcal numeric,
  p_tdee_source text,
  p_deficit_kcal integer,
  p_weight_kg numeric,
  p_activity_level public.activity_level
)
returns public.daily_targets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.daily_targets;
begin
  if v_user is null then
    raise exception 'no autenticado' using errcode = '42501';
  end if;

  insert into public.daily_targets as t (
    user_id, effective_date, target_kcal, target_source, bmr_kcal, bmr_source,
    tdee_kcal, tdee_source, deficit_kcal, weight_kg, activity_level
  ) values (
    v_user, public.user_today(), p_target_kcal, p_target_source, p_bmr_kcal, p_bmr_source,
    p_tdee_kcal, p_tdee_source, p_deficit_kcal, p_weight_kg, p_activity_level
  )
  on conflict (user_id, effective_date) do update set
    target_kcal = excluded.target_kcal,
    target_source = excluded.target_source,
    bmr_kcal = excluded.bmr_kcal,
    bmr_source = excluded.bmr_source,
    tdee_kcal = excluded.tdee_kcal,
    tdee_source = excluded.tdee_source,
    deficit_kcal = excluded.deficit_kcal,
    weight_kg = excluded.weight_kg,
    activity_level = excluded.activity_level
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.set_today_target from public, anon;
grant execute on function public.set_today_target to authenticated;

-- Objetivo vigente en una fecha para el usuario actual.
create or replace function public.target_for(p_date date)
returns public.daily_targets
language sql
stable
security invoker
set search_path = ''
as $$
  select t.* from public.daily_targets t
  where t.user_id = auth.uid() and t.effective_date <= p_date
  order by t.effective_date desc
  limit 1
$$;

revoke execute on function public.user_today(), public.target_for(date) from public, anon;
grant execute on function public.user_today(), public.target_for(date) to authenticated;
