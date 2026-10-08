-- =============================================================================
-- Copertura regionale a celle: bbox comuni, search_cells, pausa per limite
-- =============================================================================

-- -----------------------------------------------------------------------------
-- comuni: bbox (OSM/ISTAT, non Google) + popolazione
-- -----------------------------------------------------------------------------

alter table public.comuni
  add column if not exists population integer,
  add column if not exists bbox_sw_lat double precision,
  add column if not exists bbox_sw_lng double precision,
  add column if not exists bbox_ne_lat double precision,
  add column if not exists bbox_ne_lng double precision,
  add column if not exists bbox_source text not null default 'osm';

comment on column public.comuni.bbox_sw_lat is 'Latitudine angolo sud-ovest (fonte OSM/ISTAT)';
comment on column public.comuni.bbox_sw_lng is 'Longitudine angolo sud-ovest';
comment on column public.comuni.bbox_ne_lat is 'Latitudine angolo nord-est';
comment on column public.comuni.bbox_ne_lng is 'Longitudine angolo nord-est';
comment on column public.comuni.population is 'Popolazione (ordinamento: comuni piccoli prima)';
comment on column public.comuni.bbox_source is 'Origine bbox: osm | istat | manual';

create index if not exists comuni_population_idx on public.comuni (population nulls last);

-- -----------------------------------------------------------------------------
-- search_jobs / searches: stati pausa
-- -----------------------------------------------------------------------------

alter table public.search_jobs drop constraint if exists search_jobs_status_check;
alter table public.search_jobs
  add constraint search_jobs_status_check check (
    status in (
      'queued',
      'running',
      'completed',
      'partial_error',
      'failed',
      'cancelled',
      'paused',
      'paused_limit'
    )
  );

alter table public.searches drop constraint if exists searches_status_check_v2;
alter table public.searches
  add constraint searches_status_check_v2 check (
    status in (
      'draft',
      'queued',
      'running',
      'completed',
      'partial_error',
      'failed',
      'cancelled',
      'paused',
      'paused_limit'
    )
  );

alter table public.search_jobs
  add column if not exists saturated_cells integer not null default 0,
  add column if not exists pending_cells integer not null default 0,
  add column if not exists comuni_total integer not null default 0,
  add column if not exists comuni_done integer not null default 0,
  add column if not exists pause_summary text;

-- -----------------------------------------------------------------------------
-- search_cells
-- -----------------------------------------------------------------------------

create table if not exists public.search_cells (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.search_jobs (id) on delete cascade,
  search_id uuid not null references public.searches (id) on delete cascade,
  comune_id uuid not null references public.comuni (id) on delete restrict,
  keyword text not null,
  level integer not null default 0
    constraint search_cells_level_check check (level >= 0 and level <= 4),
  bbox_sw_lat double precision not null,
  bbox_sw_lng double precision not null,
  bbox_ne_lat double precision not null,
  bbox_ne_lng double precision not null,
  status text not null default 'da_fare'
    constraint search_cells_status_check check (
      status in (
        'da_fare',
        'fatto',
        'saturo',
        'errore',
        'da_verificare_manualmente'
      )
    ),
  n_risultati integer not null default 0,
  n_nuovi integer not null default 0,
  request_count integer not null default 0,
  parent_cell_id uuid references public.search_cells (id) on delete set null,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists search_cells_job_status_idx
  on public.search_cells (job_id, status, level);
create index if not exists search_cells_comune_idx
  on public.search_cells (comune_id, status);
create index if not exists search_cells_pending_idx
  on public.search_cells (job_id, status)
  where status = 'da_fare';

alter table public.search_cells enable row level security;

drop policy if exists search_cells_admin_all on public.search_cells;
create policy search_cells_admin_all
  on public.search_cells for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on table public.search_cells from anon, public;
grant select on table public.search_cells to authenticated;
grant all on table public.search_cells to service_role;

-- -----------------------------------------------------------------------------
-- RPC: copertura job (per UI)
-- -----------------------------------------------------------------------------

create or replace function public.get_search_coverage(p_search_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_comuni_total int;
  v_comuni_done int;
  v_cells_total int;
  v_cells_done int;
  v_cells_pending int;
  v_cells_saturo int;
  v_cells_manual int;
  v_cells_error int;
  v_uncovered jsonb;
begin
  if not public.is_admin() then
    raise exception 'Solo admin';
  end if;

  select id into v_job_id from public.search_jobs where search_id = p_search_id;
  if v_job_id is null then
    return jsonb_build_object('error', 'Job non trovato');
  end if;

  select count(distinct comune_id)::int into v_comuni_total
  from public.search_cells where job_id = v_job_id and level = 0;

  -- comune completato = nessuna cella da_fare per quel comune
  select count(*)::int into v_comuni_done
  from (
    select comune_id
    from public.search_cells
    where job_id = v_job_id
    group by comune_id
    having sum(case when status = 'da_fare' then 1 else 0 end) = 0
  ) done_comuni;

  select
    count(*)::int,
    count(*) filter (where status in ('fatto', 'saturo', 'da_verificare_manualmente'))::int,
    count(*) filter (where status = 'da_fare')::int,
    count(*) filter (where status = 'saturo')::int,
    count(*) filter (where status = 'da_verificare_manualmente')::int,
    count(*) filter (where status = 'errore')::int
  into v_cells_total, v_cells_done, v_cells_pending, v_cells_saturo, v_cells_manual, v_cells_error
  from public.search_cells
  where job_id = v_job_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'comune_id', co.id,
    'name', co.name,
    'province', co.province,
    'population', co.population,
    'pending_cells', pending.cnt
  ) order by coalesce(co.population, 999999999), co.name), '[]'::jsonb)
  into v_uncovered
  from public.comuni co
  join (
    select comune_id, count(*)::int as cnt
    from public.search_cells
    where job_id = v_job_id and status = 'da_fare'
    group by comune_id
  ) pending on pending.comune_id = co.id;

  return jsonb_build_object(
    'comuni_total', v_comuni_total,
    'comuni_done', v_comuni_done,
    'cells_total', v_cells_total,
    'cells_done', v_cells_done,
    'cells_pending', v_cells_pending,
    'cells_saturo', v_cells_saturo,
    'cells_manual_review', v_cells_manual,
    'cells_error', v_cells_error,
    'uncovered_comuni', v_uncovered
  );
end;
$$;

revoke all on function public.get_search_coverage(uuid) from public, anon;
grant execute on function public.get_search_coverage(uuid) to authenticated;
