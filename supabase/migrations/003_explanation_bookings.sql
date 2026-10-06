create extension if not exists btree_gist;

create table if not exists public.explanation_bookings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint explanation_bookings_duration check (ends_at = starts_at + interval '45 minutes'),
  constraint explanation_bookings_window check (
    (extract(hour from starts_at at time zone 'Europe/Rome') * 60
      + extract(minute from starts_at at time zone 'Europe/Rome')) >= (17 * 60 + 30)
    and (extract(hour from ends_at at time zone 'Europe/Rome') * 60
      + extract(minute from ends_at at time zone 'Europe/Rome')) <= (19 * 60 + 30)
  ),
  constraint explanation_bookings_no_overlap exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&)
);

create index if not exists explanation_bookings_starts_at_idx
  on public.explanation_bookings (starts_at);

alter table public.explanation_bookings enable row level security;

drop policy if exists explanation_bookings_admin_all on public.explanation_bookings;
create policy explanation_bookings_admin_all
  on public.explanation_bookings
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists explanation_bookings_select_authenticated on public.explanation_bookings;
create policy explanation_bookings_select_authenticated
  on public.explanation_bookings
  for select
  to authenticated
  using (true);

drop policy if exists explanation_bookings_insert_assigned on public.explanation_bookings;
create policy explanation_bookings_insert_assigned
  on public.explanation_bookings
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.company_assignments as assignments
      where assignments.company_id = explanation_bookings.company_id
        and assignments.user_id = auth.uid()
    )
  );

drop policy if exists explanation_bookings_delete_own on public.explanation_bookings;
create policy explanation_bookings_delete_own
  on public.explanation_bookings
  for delete
  to authenticated
  using (user_id = auth.uid());

grant select, insert, delete on public.explanation_bookings to authenticated;
grant all on public.explanation_bookings to service_role;
