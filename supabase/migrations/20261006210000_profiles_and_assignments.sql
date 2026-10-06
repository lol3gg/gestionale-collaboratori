create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role text not null default 'collaboratore',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('admin', 'collaboratore'))
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.company_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create unique index if not exists profiles_email_lower_idx
  on public.profiles (lower(email))
  where email <> '';

create index if not exists company_assignments_user_id_idx
  on public.company_assignments (user_id);

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
      nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
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
  for each row execute procedure public.handle_new_user();

insert into public.profiles (id, full_name, email, role, active)
select
  users.id,
  coalesce(
    nullif(trim(coalesce(users.raw_user_meta_data->>'full_name', '')), ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
    'Utente'
  ),
  coalesce(users.email, ''),
  'collaboratore',
  true
from auth.users as users
on conflict (id) do nothing;

revoke all on function public.handle_new_user() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_assignments enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists companies_select_admin on public.companies;
create policy companies_select_admin
  on public.companies
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists companies_select_assigned on public.companies;
create policy companies_select_assigned
  on public.companies
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.company_assignments as assignments
      where assignments.company_id = companies.id
        and assignments.user_id = auth.uid()
    )
  );

drop policy if exists assignments_select_admin on public.company_assignments;
create policy assignments_select_admin
  on public.company_assignments
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists assignments_select_own on public.company_assignments;
create policy assignments_select_own
  on public.company_assignments
  for select
  to authenticated
  using (user_id = auth.uid());

grant select on public.profiles to authenticated;
grant select on public.companies to authenticated;
grant select on public.company_assignments to authenticated;
grant all on public.profiles to service_role;
grant all on public.companies to service_role;
grant all on public.company_assignments to service_role;
