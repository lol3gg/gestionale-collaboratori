-- Orari extra aggiunti dall'admin oltre la finestra predefinita 17:30–19:30.
create table if not exists public.explanation_extra_slots (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  start_min integer not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  constraint explanation_extra_slots_start_min check (
    start_min >= (8 * 60)
    and start_min + 45 <= (21 * 60)
    and start_min % 15 = 0
  ),
  constraint explanation_extra_slots_unique unique (day, start_min)
);

create index if not exists explanation_extra_slots_day_idx
  on public.explanation_extra_slots (day);

alter table public.explanation_extra_slots enable row level security;

drop policy if exists explanation_extra_slots_select on public.explanation_extra_slots;
create policy explanation_extra_slots_select
  on public.explanation_extra_slots
  for select
  to authenticated
  using (true);

drop policy if exists explanation_extra_slots_admin_write on public.explanation_extra_slots;
create policy explanation_extra_slots_admin_write
  on public.explanation_extra_slots
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on table public.explanation_extra_slots from anon, public;
grant select on table public.explanation_extra_slots to authenticated;
grant insert, update, delete on table public.explanation_extra_slots to authenticated;
grant all on table public.explanation_extra_slots to service_role;

-- Allarga la finestra prenotabile così gli slot extra restano validi a DB.
alter table public.explanation_bookings
  drop constraint if exists explanation_bookings_window;

alter table public.explanation_bookings
  add constraint explanation_bookings_window check (
    (extract(hour from starts_at at time zone 'Europe/Rome') * 60
      + extract(minute from starts_at at time zone 'Europe/Rome')) >= (8 * 60)
    and (extract(hour from ends_at at time zone 'Europe/Rome') * 60
      + extract(minute from ends_at at time zone 'Europe/Rome')) <= (21 * 60)
  );
