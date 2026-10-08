-- =============================================================================
-- Modalità "Cerca in tutta la regione": lotti, auto-add, doppioni dubbi, annulla
-- =============================================================================

create extension if not exists pg_trgm;

-- -----------------------------------------------------------------------------
-- import_batches
-- -----------------------------------------------------------------------------

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  search_id uuid references public.searches (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  country text not null default 'IT',
  regions text[] not null default '{}',
  keywords text[] not null default '{}',
  max_requests integer not null default 100,
  auto_add boolean not null default false,
  status text not null default 'active'
    constraint import_batches_status_check check (
      status in ('active', 'completed', 'cancelled', 'partial_cancel')
    ),
  comuni_total integer not null default 0,
  comuni_done integer not null default 0,
  found_count integer not null default 0,
  inserted_count integer not null default 0,
  duplicates_safe integer not null default 0,
  duplicates_doubtful integer not null default 0,
  without_phone integer not null default 0,
  requests_count integer not null default 0,
  estimated_cost_eur numeric(10,4) not null default 0,
  cancel_deleted integer not null default 0,
  cancel_kept integer not null default 0,
  cancel_summary jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);

create index if not exists import_batches_created_at_idx
  on public.import_batches (created_at desc);
create index if not exists import_batches_search_id_idx
  on public.import_batches (search_id);

alter table public.import_batches enable row level security;

drop policy if exists import_batches_admin_all on public.import_batches;
create policy import_batches_admin_all
  on public.import_batches for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on table public.import_batches from anon, public;
grant select on table public.import_batches to authenticated;
grant all on table public.import_batches to service_role;

-- -----------------------------------------------------------------------------
-- companies: lotto + doppione dubbio
-- -----------------------------------------------------------------------------

alter table public.companies
  add column if not exists import_batch_id uuid references public.import_batches (id) on delete set null,
  add column if not exists possible_duplicate boolean not null default false,
  add column if not exists similar_company_id uuid references public.companies (id) on delete set null,
  add column if not exists duplicate_note text;

create index if not exists companies_import_batch_idx
  on public.companies (import_batch_id)
  where import_batch_id is not null;

create index if not exists companies_possible_dup_idx
  on public.companies (possible_duplicate)
  where possible_duplicate = true;

create index if not exists companies_name_trgm_idx
  on public.companies using gin (lower(name) gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- searches / search_results
-- -----------------------------------------------------------------------------

alter table public.searches
  add column if not exists regions text[] not null default '{}',
  add column if not exists auto_add_to_companies boolean not null default false,
  add column if not exists import_batch_id uuid references public.import_batches (id) on delete set null,
  add column if not exists summary jsonb;

-- sincronizza regions da region se vuoto
update public.searches
set regions = array[region]
where region is not null
  and region <> ''
  and (regions is null or cardinality(regions) = 0);

alter table public.search_results
  add column if not exists possible_duplicate boolean not null default false,
  add column if not exists similar_company_id uuid references public.companies (id) on delete set null,
  add column if not exists auto_added boolean not null default false;

-- -----------------------------------------------------------------------------
-- Stima multi-regione
-- -----------------------------------------------------------------------------

create or replace function public.estimate_places_search_regions(
  p_regions text[],
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
  where bbox_sw_lat is not null
    and (
      p_regions is null
      or array_length(p_regions, 1) is null
      or region = any (p_regions)
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

revoke all on function public.estimate_places_search_regions(text[], text[]) from public, anon;
grant execute on function public.estimate_places_search_regions(text[], text[]) to authenticated;

-- -----------------------------------------------------------------------------
-- Helper: telefono normalizzato cifre
-- -----------------------------------------------------------------------------

create or replace function public.phone_digits(p text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(p, ''), '\D', '', 'g');
$$;

create or replace function public.phones_match(a text, b text)
returns boolean
language sql
immutable
as $$
  select
    public.phone_digits(a) <> ''
    and public.phone_digits(b) <> ''
    and (
      public.phone_digits(a) = public.phone_digits(b)
      or ('39' || public.phone_digits(a)) = public.phone_digits(b)
      or public.phone_digits(a) = ('39' || public.phone_digits(b))
    );
$$;

-- -----------------------------------------------------------------------------
-- Trova azienda simile (doppione dubbio)
-- -----------------------------------------------------------------------------

create or replace function public.find_similar_company(
  p_name text,
  p_city text,
  p_address text,
  p_exclude_id uuid default null
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select c.id into v_id
  from public.companies c
  where (p_exclude_id is null or c.id <> p_exclude_id)
    and similarity(lower(trim(c.name)), lower(trim(p_name))) >= 0.55
    and (
      (
        coalesce(trim(p_city), '') <> ''
        and lower(trim(c.city)) = lower(trim(p_city))
      )
      or (
        coalesce(trim(p_address), '') <> ''
        and coalesce(trim(c.address), '') <> ''
        and similarity(lower(c.address), lower(p_address)) >= 0.5
      )
    )
  order by similarity(lower(trim(c.name)), lower(trim(p_name))) desc
  limit 1;

  return v_id;
end;
$$;

revoke all on function public.find_similar_company(text, text, text, uuid) from public, anon;
grant execute on function public.find_similar_company(text, text, text, uuid) to authenticated;
grant execute on function public.find_similar_company(text, text, text, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- Ingest risultati → companies (manual o auto)
-- -----------------------------------------------------------------------------

create or replace function public.ingest_search_results_to_companies(
  p_ids uuid[],
  p_batch_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_inserted int := 0;
  v_duplicates int := 0;
  v_doubtful int := 0;
  v_skipped int := 0;
  v_no_phone int := 0;
  r record;
  v_company_id uuid;
  v_similar uuid;
  v_is_service boolean := (auth.role() = 'service_role');
begin
  if not v_is_service then
    v_uid := public.require_active_user();
    if not public.is_admin() then
      raise exception 'Solo gli amministratori possono aggiungere aziende dalla ricerca';
    end if;
  end if;

  if p_ids is null or array_length(p_ids, 1) is null then
    return jsonb_build_object(
      'inserted', 0, 'duplicates', 0, 'doubtful', 0, 'skipped', 0, 'without_phone', 0
    );
  end if;

  for r in
    select *
    from public.search_results
    where id = any (p_ids)
      and discarded = false
      and added_company_id is null
    for update
  loop
    -- Doppione sicuro già flaggato
    if r.is_duplicate_in_db then
      v_duplicates := v_duplicates + 1;
      continue;
    end if;

    -- Doppione sicuro: google_place_id
    if r.google_place_id is not null and exists (
      select 1 from public.companies c where c.google_place_id = r.google_place_id
    ) then
      v_duplicates := v_duplicates + 1;
      update public.search_results
      set is_duplicate_in_db = true
      where id = r.id;
      continue;
    end if;

    -- Doppione sicuro: telefono
    if r.phone_normalized <> '' and exists (
      select 1 from public.companies c
      where c.phone <> '' and public.phones_match(c.phone, r.phone_normalized)
    ) then
      v_duplicates := v_duplicates + 1;
      update public.search_results
      set is_duplicate_in_db = true
      where id = r.id;
      continue;
    end if;

    v_similar := public.find_similar_company(r.name, r.city, r.address, null);

    insert into public.companies (
      name, phone, email, website, address, city, province, region, country,
      employees, status, assigned_to, google_place_id, source, fetched_at,
      import_batch_id, possible_duplicate, similar_company_id, duplicate_note
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
      r.fetched_at,
      p_batch_id,
      v_similar is not null,
      v_similar,
      case when v_similar is not null then 'Possibile doppione: nome simile nello stesso comune/indirizzo' else null end
    )
    returning id into v_company_id;

    update public.search_results
    set
      added_company_id = v_company_id,
      possible_duplicate = (v_similar is not null),
      similar_company_id = v_similar,
      auto_added = coalesce(
        (select auto_add from public.import_batches where id = p_batch_id),
        false
      )
    where id = r.id;

    v_inserted := v_inserted + 1;
    if v_similar is not null then
      v_doubtful := v_doubtful + 1;
    end if;
    if coalesce(nullif(r.phone, ''), '') = '' then
      v_no_phone := v_no_phone + 1;
    end if;
  end loop;

  -- Aggiorna conteggi batch
  if p_batch_id is not null then
    update public.import_batches b
    set
      inserted_count = coalesce((
        select count(*)::int from public.companies c where c.import_batch_id = b.id
      ), 0),
      duplicates_doubtful = coalesce((
        select count(*)::int from public.companies c
        where c.import_batch_id = b.id and c.possible_duplicate
      ), 0),
      without_phone = coalesce((
        select count(*)::int from public.companies c
        where c.import_batch_id = b.id and c.phone = ''
      ), 0)
    where b.id = p_batch_id;
  end if;

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
    'doubtful', v_doubtful,
    'skipped', v_skipped,
    'without_phone', v_no_phone
  );
end;
$$;

revoke all on function public.ingest_search_results_to_companies(uuid[], uuid) from public, anon;
grant execute on function public.ingest_search_results_to_companies(uuid[], uuid) to authenticated;
grant execute on function public.ingest_search_results_to_companies(uuid[], uuid) to service_role;

-- Mantieni alias della vecchia RPC
create or replace function public.add_search_results_to_companies(p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch uuid;
  v_search uuid;
begin
  select search_id into v_search
  from public.search_results
  where id = any (p_ids)
  limit 1;

  if v_search is not null then
    select import_batch_id into v_batch from public.searches where id = v_search;
  end if;

  return public.ingest_search_results_to_companies(p_ids, v_batch);
end;
$$;

-- -----------------------------------------------------------------------------
-- Finalizza riepilogo lotto
-- -----------------------------------------------------------------------------

create or replace function public.finalize_import_batch(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.import_batches%rowtype;
  v_search public.searches%rowtype;
  v_found int;
  v_dup_safe int;
  v_summary jsonb;
  v_cost_each numeric;
begin
  select * into v_batch from public.import_batches where id = p_batch_id for update;
  if not found then
    raise exception 'Lotto non trovato';
  end if;

  if v_batch.search_id is not null then
    select * into v_search from public.searches where id = v_batch.search_id;
  end if;

  select count(*)::int into v_found
  from public.search_results
  where search_id = v_batch.search_id;

  select count(*)::int into v_dup_safe
  from public.search_results
  where search_id = v_batch.search_id
    and is_duplicate_in_db = true
    and added_company_id is null;

  select coalesce((value #>> '{}')::numeric, 0.032) into v_cost_each
  from public.app_settings
  where key = 'places_cost_per_request_eur';
  if v_cost_each is null then v_cost_each := 0.032; end if;

  update public.import_batches b
  set
    status = 'completed',
    completed_at = now(),
    comuni_total = coalesce((
      select j.comuni_total from public.search_jobs j where j.search_id = b.search_id
    ), b.comuni_total),
    comuni_done = coalesce((
      select j.comuni_done from public.search_jobs j where j.search_id = b.search_id
    ), b.comuni_done),
    found_count = v_found,
    inserted_count = coalesce((
      select count(*)::int from public.companies c where c.import_batch_id = b.id
    ), 0),
    duplicates_safe = v_dup_safe,
    duplicates_doubtful = coalesce((
      select count(*)::int from public.companies c
      where c.import_batch_id = b.id and c.possible_duplicate
    ), 0),
    without_phone = coalesce((
      select count(*)::int from public.companies c
      where c.import_batch_id = b.id and c.phone = ''
    ), 0),
    requests_count = coalesce(v_search.actual_requests, b.requests_count),
    estimated_cost_eur = round(coalesce(v_search.actual_requests, 0) * v_cost_each, 4)
  where b.id = p_batch_id
  returning * into v_batch;

  v_summary := jsonb_build_object(
    'comuni_done', v_batch.comuni_done,
    'comuni_total', v_batch.comuni_total,
    'found', v_batch.found_count,
    'inserted', v_batch.inserted_count,
    'duplicates_safe', v_batch.duplicates_safe,
    'duplicates_doubtful', v_batch.duplicates_doubtful,
    'without_phone', v_batch.without_phone,
    'requests', v_batch.requests_count,
    'estimated_cost_eur', v_batch.estimated_cost_eur
  );

  if v_batch.search_id is not null then
    update public.searches
    set summary = v_summary
    where id = v_batch.search_id;
  end if;

  return v_summary;
end;
$$;

revoke all on function public.finalize_import_batch(uuid) from public, anon;
grant execute on function public.finalize_import_batch(uuid) to authenticated;
grant execute on function public.finalize_import_batch(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- Annulla lotto (solo aziende non lavorate)
-- -----------------------------------------------------------------------------

create or replace function public.cancel_import_batch(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int := 0;
  v_kept int := 0;
  v_kept_assigned int := 0;
  v_kept_called int := 0;
  r record;
  v_has_logs boolean;
begin
  if not public.is_admin() then
    raise exception 'Solo admin';
  end if;

  if not exists (select 1 from public.import_batches where id = p_batch_id) then
    raise exception 'Lotto non trovato';
  end if;

  for r in
    select c.id, c.assigned_to, c.name
    from public.companies c
    where c.import_batch_id = p_batch_id
    for update
  loop
    select exists (
      select 1 from public.call_logs cl where cl.company_id = r.id
    ) into v_has_logs;

    if r.assigned_to is not null then
      v_kept := v_kept + 1;
      v_kept_assigned := v_kept_assigned + 1;
    elsif v_has_logs then
      v_kept := v_kept + 1;
      v_kept_called := v_kept_called + 1;
    else
      delete from public.companies where id = r.id;
      v_deleted := v_deleted + 1;
    end if;
  end loop;

  update public.import_batches
  set
    status = case when v_kept > 0 then 'partial_cancel' else 'cancelled' end,
    cancelled_at = now(),
    cancel_deleted = v_deleted,
    cancel_kept = v_kept,
    cancel_summary = jsonb_build_object(
      'deleted', v_deleted,
      'kept', v_kept,
      'kept_assigned', v_kept_assigned,
      'kept_called', v_kept_called
    )
  where id = p_batch_id;

  return jsonb_build_object(
    'deleted', v_deleted,
    'kept', v_kept,
    'kept_assigned', v_kept_assigned,
    'kept_called', v_kept_called
  );
end;
$$;

revoke all on function public.cancel_import_batch(uuid) from public, anon;
grant execute on function public.cancel_import_batch(uuid) to authenticated;
