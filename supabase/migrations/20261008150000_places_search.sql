-- =============================================================================
-- Ricerca aziende via Google Places: comuni, jobs, results, estensione searches
-- =============================================================================

-- -----------------------------------------------------------------------------
-- companies: metadati Places
-- -----------------------------------------------------------------------------

alter table public.companies
  add column if not exists google_place_id text,
  add column if not exists source text not null default 'manual',
  add column if not exists fetched_at timestamptz;

create unique index if not exists companies_google_place_id_uidx
  on public.companies (google_place_id)
  where google_place_id is not null;

comment on column public.companies.google_place_id is 'ID Google Places (unico se presente)';
comment on column public.companies.source is 'Origine: manual | google_places | import';

-- -----------------------------------------------------------------------------
-- settings (limite giornaliero richieste)
-- -----------------------------------------------------------------------------

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists app_settings_admin_all on public.app_settings;
create policy app_settings_admin_all
  on public.app_settings for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on table public.app_settings from anon, public;
grant select, insert, update, delete on table public.app_settings to authenticated;
grant all on table public.app_settings to service_role;

insert into public.app_settings (key, value)
values
  ('places_daily_request_limit', '500'::jsonb),
  ('places_cost_per_request_eur', '0.032'::jsonb)
on conflict (key) do nothing;

-- Contatore giornaliero richieste Places
create table if not exists public.places_usage_daily (
  day date primary key default ((now() at time zone 'Europe/Rome')::date),
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.places_usage_daily enable row level security;

drop policy if exists places_usage_admin_select on public.places_usage_daily;
create policy places_usage_admin_select
  on public.places_usage_daily for select to authenticated
  using (public.is_admin());

revoke all on table public.places_usage_daily from anon, public;
grant select on table public.places_usage_daily to authenticated;
grant all on table public.places_usage_daily to service_role;

-- -----------------------------------------------------------------------------
-- comuni (seed ISTAT ridotto: Lombardia MI + CO per test)
-- -----------------------------------------------------------------------------

create table if not exists public.comuni (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  province text not null,
  region text not null,
  istat_code text not null,
  country text not null default 'IT',
  created_at timestamptz not null default now(),
  constraint comuni_istat_unique unique (istat_code),
  constraint comuni_province_len check (char_length(province) = 2)
);

create index if not exists comuni_region_province_idx on public.comuni (region, province);
create index if not exists comuni_province_idx on public.comuni (province);

alter table public.comuni enable row level security;

drop policy if exists comuni_admin_select on public.comuni;
create policy comuni_admin_select
  on public.comuni for select to authenticated
  using (public.is_admin());

drop policy if exists comuni_admin_all on public.comuni;
create policy comuni_admin_all
  on public.comuni for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on table public.comuni from anon, public;
grant select on table public.comuni to authenticated;
grant all on table public.comuni to service_role;

-- -----------------------------------------------------------------------------
-- Estensione searches
-- -----------------------------------------------------------------------------

alter table public.searches
  add column if not exists country text not null default 'IT',
  add column if not exists provinces text[] not null default '{}',
  add column if not exists keywords text[] not null default '{}',
  add column if not exists max_requests integer not null default 100,
  add column if not exists estimated_queries integer not null default 0,
  add column if not exists estimated_cost_eur numeric(10,4) not null default 0,
  add column if not exists actual_requests integer not null default 0,
  add column if not exists results_count integer not null default 0,
  add column if not exists added_count integer not null default 0,
  add column if not exists error_message text,
  add column if not exists completed_at timestamptz;

-- Migra vecchi filtri salvati (status = stato azienda) → draft per Places
alter table public.searches drop constraint if exists searches_status_check;
alter table public.searches drop constraint if exists searches_status_check_v2;

update public.searches
set status = 'draft'
where status is null
   or status in (
     'da_chiamare', 'non_risponde', 'da_richiamare',
     'accettato', 'rifiutato', 'numero_errato'
   );

alter table public.searches alter column status set default 'draft';
update public.searches set status = 'draft' where status is null;
alter table public.searches alter column status set not null;

alter table public.searches
  add constraint searches_status_check_v2 check (
    status in (
      'draft',
      'queued',
      'running',
      'completed',
      'partial_error',
      'failed',
      'cancelled'
    )
  );

-- Se province singola valorizzata e provinces vuoto, copia in array
update public.searches
set provinces = array[province]
where province is not null
  and province <> ''
  and (provinces is null or cardinality(provinces) = 0);

-- Parametri geografici in region/provinces; status = stato job ricerca.

-- -----------------------------------------------------------------------------
-- search_jobs
-- -----------------------------------------------------------------------------

create table if not exists public.search_jobs (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.searches (id) on delete cascade,
  status text not null default 'queued'
    constraint search_jobs_status_check check (
      status in ('queued', 'running', 'completed', 'partial_error', 'failed', 'cancelled')
    ),
  total_queries integer not null default 0,
  completed_queries integer not null default 0,
  cursor_offset integer not null default 0,
  batch_size integer not null default 10,
  request_count integer not null default 0,
  error_message text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint search_jobs_search_unique unique (search_id)
);

create index if not exists search_jobs_status_idx on public.search_jobs (status, updated_at desc);

alter table public.search_jobs enable row level security;

drop policy if exists search_jobs_admin_all on public.search_jobs;
create policy search_jobs_admin_all
  on public.search_jobs for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on table public.search_jobs from anon, public;
grant select on table public.search_jobs to authenticated;
grant all on table public.search_jobs to service_role;

-- -----------------------------------------------------------------------------
-- search_results (tabella di appoggio)
-- -----------------------------------------------------------------------------

create table if not exists public.search_results (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.searches (id) on delete cascade,
  google_place_id text,
  name text not null,
  phone text not null default '',
  phone_normalized text not null default '',
  website text not null default '',
  address text,
  city text not null default '',
  province text not null default '',
  region text not null default '',
  country text not null default 'IT',
  business_status text,
  is_duplicate_in_db boolean not null default false,
  is_duplicate_in_search boolean not null default false,
  discarded boolean not null default false,
  added_company_id uuid references public.companies (id) on delete set null,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists search_results_search_id_idx on public.search_results (search_id, created_at desc);
create index if not exists search_results_place_idx on public.search_results (google_place_id)
  where google_place_id is not null;
create index if not exists search_results_phone_idx on public.search_results (phone_normalized)
  where phone_normalized <> '';

alter table public.search_results enable row level security;

drop policy if exists search_results_admin_all on public.search_results;
create policy search_results_admin_all
  on public.search_results for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on table public.search_results from anon, public;
grant select, update on table public.search_results to authenticated;
grant all on table public.search_results to service_role;

-- searches: aggiorna policy (già admin_all + own). Assicurati che admin veda tutto.
drop policy if exists searches_admin_all on public.searches;
create policy searches_admin_all
  on public.searches for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- RPC: aggiungi risultati selezionati a companies
-- -----------------------------------------------------------------------------

create or replace function public.add_search_results_to_companies(p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_active_user();
  v_inserted int := 0;
  v_duplicates int := 0;
  v_skipped int := 0;
  r record;
  v_company_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo gli amministratori possono aggiungere aziende dalla ricerca';
  end if;

  if p_ids is null or array_length(p_ids, 1) is null then
    return jsonb_build_object('inserted', 0, 'duplicates', 0, 'skipped', 0);
  end if;

  for r in
    select *
    from public.search_results
    where id = any (p_ids)
      and discarded = false
      and added_company_id is null
    for update
  loop
    if r.is_duplicate_in_db then
      v_duplicates := v_duplicates + 1;
      continue;
    end if;

    if r.google_place_id is not null and exists (
      select 1 from public.companies c where c.google_place_id = r.google_place_id
    ) then
      v_duplicates := v_duplicates + 1;
      update public.search_results set is_duplicate_in_db = true where id = r.id;
      continue;
    end if;

    if r.phone_normalized <> '' and exists (
      select 1
      from public.companies c
      where c.phone <> ''
        and regexp_replace(c.phone, '\D', '', 'g') <> ''
        and (
          regexp_replace(c.phone, '\D', '', 'g') = regexp_replace(r.phone_normalized, '\D', '', 'g')
          or ('39' || regexp_replace(c.phone, '\D', '', 'g')) = regexp_replace(r.phone_normalized, '\D', '', 'g')
          or regexp_replace(c.phone, '\D', '', 'g') = ('39' || regexp_replace(r.phone_normalized, '\D', '', 'g'))
        )
    ) then
      v_duplicates := v_duplicates + 1;
      update public.search_results set is_duplicate_in_db = true where id = r.id;
      continue;
    end if;

    insert into public.companies (
      name, phone, email, website, address, city, province, region, country,
      employees, status, assigned_to, google_place_id, source, fetched_at
    ) values (
      r.name,
      coalesce(nullif(r.phone, ''), ''),
      null,
      coalesce(r.website, ''),
      r.address,
      coalesce(r.city, ''),
      coalesce(r.province, ''),
      coalesce(r.region, ''),
      coalesce(r.country, 'IT'),
      null,
      'da_chiamare',
      null,
      r.google_place_id,
      'google_places',
      r.fetched_at
    )
    returning id into v_company_id;

    update public.search_results
    set added_company_id = v_company_id
    where id = r.id;

    v_inserted := v_inserted + 1;
  end loop;

  update public.searches s
  set added_count = coalesce((
    select count(*)::int from public.search_results sr
    where sr.search_id = s.id and sr.added_company_id is not null
  ), 0)
  where s.id in (
    select distinct search_id from public.search_results where id = any (p_ids)
  );

  return jsonb_build_object(
    'inserted', v_inserted,
    'duplicates', v_duplicates,
    'skipped', v_skipped
  );
end;
$$;

revoke all on function public.add_search_results_to_companies(uuid[]) from public, anon;
grant execute on function public.add_search_results_to_companies(uuid[]) to authenticated;

-- -----------------------------------------------------------------------------
-- Helper: stima query (comuni x keywords)
-- -----------------------------------------------------------------------------

create or replace function public.estimate_places_search(
  p_region text,
  p_provinces text[],
  p_keywords text[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_comuni int;
  v_keywords int;
  v_queries int;
  v_cost numeric;
  v_cost_each numeric;
begin
  if not public.is_admin() then
    raise exception 'Solo admin';
  end if;

  select count(*)::int into v_comuni
  from public.comuni
  where region = p_region
    and (
      p_provinces is null
      or array_length(p_provinces, 1) is null
      or province = any (p_provinces)
    );

  v_keywords := greatest(coalesce(array_length(p_keywords, 1), 0), 0);
  v_queries := v_comuni * v_keywords;

  select coalesce((value #>> '{}')::numeric, 0.032) into v_cost_each
  from public.app_settings
  where key = 'places_cost_per_request_eur';

  if v_cost_each is null then
    v_cost_each := 0.032;
  end if;

  v_cost := round(v_queries * v_cost_each, 4);

  return jsonb_build_object(
    'comuni', v_comuni,
    'keywords', v_keywords,
    'queries', v_queries,
    'estimated_cost_eur', v_cost,
    'cost_per_request_eur', v_cost_each
  );
end;
$$;

revoke all on function public.estimate_places_search(text, text[], text[]) from public, anon;
grant execute on function public.estimate_places_search(text, text[], text[]) to authenticated;
