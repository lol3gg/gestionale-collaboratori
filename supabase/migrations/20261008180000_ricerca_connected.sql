-- =============================================================================
-- Ricerca collegata: stime per province, accesso anon (AUTH_BYPASS preview),
-- lettura comuni / job / risultati per la UI senza login.
-- =============================================================================

-- Lettura geo e risultati ricerca per anteprima senza JWT utente
grant select on table public.comuni to anon;
grant select on table public.search_jobs to anon;
grant select on table public.search_cells to anon;
grant select on table public.search_results to anon;
grant select on table public.import_batches to anon;

drop policy if exists temp_anon_comuni_select on public.comuni;
create policy temp_anon_comuni_select
  on public.comuni for select to anon using (true);

drop policy if exists temp_anon_search_jobs_select on public.search_jobs;
create policy temp_anon_search_jobs_select
  on public.search_jobs for select to anon using (true);

drop policy if exists temp_anon_search_cells_select on public.search_cells;
create policy temp_anon_search_cells_select
  on public.search_cells for select to anon using (true);

drop policy if exists temp_anon_search_results_select on public.search_results;
create policy temp_anon_search_results_select
  on public.search_results for select to anon using (true);

drop policy if exists temp_anon_import_batches_select on public.import_batches;
create policy temp_anon_import_batches_select
  on public.import_batches for select to anon using (true);

-- Stima multi-regione + province (1 richiesta = 1 comune × keyword)
drop function if exists public.estimate_places_search_regions(text[], text[]);
drop function if exists public.estimate_places_search_regions(text[], text[], text[]);

create or replace function public.estimate_places_search_regions(
  p_regions text[],
  p_keywords text[],
  p_provinces text[] default null
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
  v_preview jsonb;
begin
  -- Anteprima anon (AUTH_BYPASS) oppure admin autenticato
  if auth.role() = 'authenticated' and not public.is_admin() then
    raise exception 'Solo admin';
  end if;

  select count(*)::int into v_comuni
  from public.comuni
  where bbox_sw_lat is not null
    and (
      p_regions is null
      or array_length(p_regions, 1) is null
      or region = any (p_regions)
    )
    and (
      p_provinces is null
      or array_length(p_provinces, 1) is null
      or province = any (p_provinces)
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object('name', c.name, 'province', c.province, 'population', c.population)
      order by coalesce(c.population, 999999999), c.name
    ),
    '[]'::jsonb
  )
  into v_preview
  from (
    select name, province, population
    from public.comuni
    where bbox_sw_lat is not null
      and (
        p_regions is null
        or array_length(p_regions, 1) is null
        or region = any (p_regions)
      )
      and (
        p_provinces is null
        or array_length(p_provinces, 1) is null
        or province = any (p_provinces)
      )
    order by coalesce(population, 999999999), name
    limit 80
  ) c;

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
    'cost_per_request_eur', v_cost_each,
    'comuni_preview', v_preview
  );
end;
$$;

revoke all on function public.estimate_places_search_regions(text[], text[], text[]) from public;
grant execute on function public.estimate_places_search_regions(text[], text[], text[]) to authenticated, anon;

-- Copertura leggibile anche in anteprima anon
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
  if auth.role() = 'authenticated' and not public.is_admin() then
    raise exception 'Solo admin';
  end if;

  select id into v_job_id from public.search_jobs where search_id = p_search_id;
  if v_job_id is null then
    return jsonb_build_object('error', 'Job non trovato');
  end if;

  select count(distinct comune_id)::int into v_comuni_total
  from public.search_cells where job_id = v_job_id and level = 0;

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

revoke all on function public.get_search_coverage(uuid) from public;
grant execute on function public.get_search_coverage(uuid) to authenticated, anon;
