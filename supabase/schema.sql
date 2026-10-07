-- Schema Gestione Collaboratori.
-- Eseguibile più volte nel SQL Editor di Supabase.
-- Il primo utente nasce sempre come collaboratore: va promosso ad admin a mano.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role text not null default 'collaboratore',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'collaboratore'));

create unique index if not exists profiles_email_lower_idx
  on public.profiles (lower(email))
  where email <> '';

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null default '',
  email text,
  website text not null default '',
  address text,
  city text not null default '',
  province text not null default '',
  region text not null default '',
  employees integer,
  status text not null default 'da_chiamare',
  assigned_to uuid references public.profiles (id) on delete set null,
  callback_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.companies add column if not exists phone text not null default '';
alter table public.companies add column if not exists email text;
alter table public.companies add column if not exists website text not null default '';
alter table public.companies add column if not exists address text;
alter table public.companies add column if not exists city text not null default '';
alter table public.companies add column if not exists province text not null default '';
alter table public.companies add column if not exists region text not null default '';
alter table public.companies add column if not exists employees integer;
alter table public.companies add column if not exists status text not null default 'da_chiamare';
alter table public.companies add column if not exists assigned_to uuid references public.profiles (id) on delete set null;
alter table public.companies add column if not exists callback_at timestamptz;
alter table public.companies add column if not exists created_at timestamptz not null default now();

alter table public.companies drop constraint if exists companies_status_check;
alter table public.companies
  add constraint companies_status_check
  check (status in ('da_chiamare', 'non_risponde', 'da_richiamare', 'accettato', 'rifiutato', 'numero_errato'));

alter table public.companies drop constraint if exists companies_callback_check;
alter table public.companies
  add constraint companies_callback_check
  check (status <> 'da_richiamare' or callback_at is not null);

create index if not exists companies_name_idx on public.companies (name);
create index if not exists companies_region_idx on public.companies (region);
create index if not exists companies_city_idx on public.companies (city);
create index if not exists companies_status_idx on public.companies (status);
create index if not exists companies_assigned_to_idx on public.companies (assigned_to);

create table if not exists public.company_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete restrict,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.company_notes drop constraint if exists company_notes_body_check;
alter table public.company_notes
  add constraint company_notes_body_check
  check (char_length(btrim(body)) between 1 and 2000);

create index if not exists company_notes_company_id_idx
  on public.company_notes (company_id, created_at desc);

create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete restrict,
  outcome text not null,
  note text,
  callback_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.call_logs drop constraint if exists call_logs_outcome_check;
alter table public.call_logs
  add constraint call_logs_outcome_check
  check (outcome in ('da_chiamare', 'non_risponde', 'da_richiamare', 'accettato', 'rifiutato', 'numero_errato'));

alter table public.call_logs drop constraint if exists call_logs_note_check;
alter table public.call_logs
  add constraint call_logs_note_check
  check (note is null or char_length(note) <= 2000);

alter table public.call_logs drop constraint if exists call_logs_callback_check;
alter table public.call_logs
  add constraint call_logs_callback_check
  check (outcome <> 'da_richiamare' or callback_at is not null);

create index if not exists call_logs_company_id_idx on public.call_logs (company_id, created_at desc);
create index if not exists call_logs_user_id_idx on public.call_logs (user_id, created_at desc);

create table if not exists public.searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  query text not null default '',
  region text,
  province text,
  city text,
  status text,
  created_at timestamptz not null default now()
);

alter table public.searches drop constraint if exists searches_status_check;
alter table public.searches
  add constraint searches_status_check
  check (
    status is null
    or status in ('da_chiamare', 'non_risponde', 'da_richiamare', 'accettato', 'rifiutato', 'numero_errato')
  );

create index if not exists searches_user_id_idx on public.searches (user_id, created_at desc);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and active = true
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, active)
  values (
    new.id,
    coalesce(
      nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Utente'
    ),
    coalesce(new.email, ''),
    'collaboratore',
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, full_name, email, role, active)
select
  users.id,
  coalesce(
    nullif(trim(coalesce(users.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
    'Utente'
  ),
  coalesce(users.email, ''),
  'collaboratore',
  true
from auth.users as users
on conflict (id) do nothing;

create or replace function public.guard_company_collaborator_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.name is distinct from old.name
    or new.phone is distinct from old.phone
    or new.email is distinct from old.email
    or new.website is distinct from old.website
    or new.address is distinct from old.address
    or new.city is distinct from old.city
    or new.province is distinct from old.province
    or new.region is distinct from old.region
    or new.employees is distinct from old.employees
    or new.assigned_to is distinct from old.assigned_to
    or new.created_at is distinct from old.created_at
    or new.id is distinct from old.id
  then
    raise exception 'Puoi aggiornare solo lo stato e la data del richiamo';
  end if;

  return new;
end;
$$;

drop trigger if exists companies_guard_collaborator_update on public.companies;
create trigger companies_guard_collaborator_update
  before update on public.companies
  for each row execute function public.guard_company_collaborator_update();

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.guard_company_collaborator_update() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_notes enable row level security;
alter table public.call_logs enable row level security;
alter table public.searches enable row level security;

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all
  on public.profiles
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated
  on public.profiles
  for select
  to authenticated
  using (true);

drop policy if exists companies_admin_all on public.companies;
create policy companies_admin_all
  on public.companies
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists companies_select_assigned_or_pool on public.companies;
create policy companies_select_assigned_or_pool
  on public.companies
  for select
  to authenticated
  using (assigned_to = auth.uid() or assigned_to is null);

drop policy if exists companies_update_assigned_or_pool on public.companies;
create policy companies_update_assigned_or_pool
  on public.companies
  for update
  to authenticated
  using (assigned_to = auth.uid() or assigned_to is null)
  with check (assigned_to = auth.uid() or assigned_to is null);

drop policy if exists company_notes_admin_all on public.company_notes;
create policy company_notes_admin_all
  on public.company_notes
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists company_notes_select_assigned_or_pool on public.company_notes;
create policy company_notes_select_assigned_or_pool
  on public.company_notes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.companies
      where companies.id = company_notes.company_id
        and (companies.assigned_to = auth.uid() or companies.assigned_to is null)
    )
  );

drop policy if exists company_notes_insert_assigned_or_pool on public.company_notes;
create policy company_notes_insert_assigned_or_pool
  on public.company_notes
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1
      from public.companies
      where companies.id = company_notes.company_id
        and (companies.assigned_to = auth.uid() or companies.assigned_to is null)
    )
  );

drop policy if exists call_logs_admin_all on public.call_logs;
create policy call_logs_admin_all
  on public.call_logs
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists call_logs_select_assigned_or_pool on public.call_logs;
create policy call_logs_select_assigned_or_pool
  on public.call_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.companies
      where companies.id = call_logs.company_id
        and (companies.assigned_to = auth.uid() or companies.assigned_to is null)
    )
  );

drop policy if exists call_logs_insert_assigned_or_pool on public.call_logs;
create policy call_logs_insert_assigned_or_pool
  on public.call_logs
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.companies
      where companies.id = call_logs.company_id
        and (companies.assigned_to = auth.uid() or companies.assigned_to is null)
    )
  );

drop policy if exists searches_admin_all on public.searches;
create policy searches_admin_all
  on public.searches
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists searches_select_own on public.searches;
create policy searches_select_own
  on public.searches
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists searches_insert_own on public.searches;
create policy searches_insert_own
  on public.searches
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists searches_update_own on public.searches;
create policy searches_update_own
  on public.searches
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists searches_delete_own on public.searches;
create policy searches_delete_own
  on public.searches
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Call di spiegazione (calendario)
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
      + extract(minute from starts_at at time zone 'Europe/Rome')) >= (8 * 60)
    and (extract(hour from ends_at at time zone 'Europe/Rome') * 60
      + extract(minute from ends_at at time zone 'Europe/Rome')) <= (21 * 60)
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
      from public.companies as company
      where company.id = explanation_bookings.company_id
        and company.assigned_to = auth.uid()
    )
  );

drop policy if exists explanation_bookings_delete_own on public.explanation_bookings;
create policy explanation_bookings_delete_own
  on public.explanation_bookings
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Orari extra aggiunti dall'admin (oltre 17:30–19:30)
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

revoke all on table public.profiles from anon, public;
revoke all on table public.companies from anon, public;
revoke all on table public.company_notes from anon, public;
revoke all on table public.call_logs from anon, public;
revoke all on table public.searches from anon, public;
revoke all on table public.explanation_bookings from anon, public;
revoke all on table public.explanation_extra_slots from anon, public;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.companies to authenticated;
grant select, insert, update, delete on public.company_notes to authenticated;
grant select, insert, update, delete on public.call_logs to authenticated;
grant select, insert, update, delete on public.searches to authenticated;
grant select, insert, delete on public.explanation_bookings to authenticated;
grant select, insert, update, delete on public.explanation_extra_slots to authenticated;

grant all on table public.profiles to service_role;
grant all on table public.companies to service_role;
grant all on table public.company_notes to service_role;
grant all on table public.call_logs to service_role;
grant all on table public.searches to service_role;
grant all on table public.explanation_bookings to service_role;
grant all on table public.explanation_extra_slots to service_role;

-- Nessuna policy è creata per il ruolo anon: solo authenticated e service_role.
