alter table public.companies
  add column if not exists phone text not null default '',
  add column if not exists status text not null default 'da_chiamare',
  add column if not exists callback_at timestamptz;

alter table public.companies drop constraint if exists companies_status_check;
alter table public.companies
  add constraint companies_status_check
  check (status in ('da_chiamare', 'non_risponde', 'da_richiamare', 'accettato', 'rifiutato', 'numero_errato'));

create unique index if not exists company_assignments_one_assignee_idx
  on public.company_assignments (company_id);

create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete restrict,
  outcome text not null,
  note text,
  callback_at timestamptz,
  created_at timestamptz not null default now(),
  constraint call_logs_outcome_check check (
    outcome in ('da_chiamare', 'non_risponde', 'da_richiamare', 'accettato', 'rifiutato', 'numero_errato')
  )
);

create index if not exists call_logs_company_id_idx on public.call_logs (company_id, created_at desc);
create index if not exists call_logs_user_id_idx on public.call_logs (user_id, created_at desc);

alter table public.call_logs enable row level security;

drop policy if exists call_logs_admin_all on public.call_logs;
create policy call_logs_admin_all
  on public.call_logs
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists call_logs_select_assigned on public.call_logs;
create policy call_logs_select_assigned
  on public.call_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.company_assignments as assignments
      where assignments.company_id = call_logs.company_id
        and assignments.user_id = auth.uid()
    )
  );

drop policy if exists call_logs_insert_assigned on public.call_logs;
create policy call_logs_insert_assigned
  on public.call_logs
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.company_assignments as assignments
      where assignments.company_id = call_logs.company_id
        and assignments.user_id = auth.uid()
    )
  );

drop policy if exists call_logs_delete_assigned on public.call_logs;
create policy call_logs_delete_assigned
  on public.call_logs
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.company_assignments as assignments
      where assignments.company_id = call_logs.company_id
        and assignments.user_id = auth.uid()
    )
  );

drop policy if exists companies_select_pool on public.companies;
create policy companies_select_pool
  on public.companies
  for select
  to authenticated
  using (
    not exists (
      select 1
      from public.company_assignments as assignments
      where assignments.company_id = companies.id
    )
  );

drop policy if exists companies_admin_write on public.companies;
create policy companies_admin_write
  on public.companies
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists companies_update_assigned on public.companies;
create policy companies_update_assigned
  on public.companies
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.company_assignments as assignments
      where assignments.company_id = companies.id
        and assignments.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.company_assignments as assignments
      where assignments.company_id = companies.id
        and assignments.user_id = auth.uid()
    )
  );

drop policy if exists assignments_admin_write on public.company_assignments;
create policy assignments_admin_write
  on public.company_assignments
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists assignments_insert_claim on public.company_assignments;
create policy assignments_insert_claim
  on public.company_assignments
  for insert
  to authenticated
  with check (user_id = auth.uid());

revoke all on table public.call_logs from anon, public;

grant select, insert, update, delete on public.call_logs to authenticated;
grant insert, update, delete on public.companies to authenticated;
grant insert, update, delete on public.company_assignments to authenticated;
grant all on public.call_logs to service_role;
