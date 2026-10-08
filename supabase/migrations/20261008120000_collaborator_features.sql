-- Funzioni collaboratore: daily_goal, claim/release con limite, dashboard_stats arricchita, next_company

-- -----------------------------------------------------------------------------
-- Constanti / colonne
-- -----------------------------------------------------------------------------

alter table public.profiles
  add column if not exists daily_goal integer not null default 30;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_daily_goal_check'
  ) then
    alter table public.profiles
      add constraint profiles_daily_goal_check check (daily_goal >= 1 and daily_goal <= 500);
  end if;
end $$;

comment on column public.profiles.daily_goal is 'Obiettivo chiamate giornaliere del collaboratore';

create or replace function public.max_claimed_companies()
returns integer
language sql
immutable
as $$
  select 30;
$$;

revoke all on function public.max_claimed_companies() from public, anon;
grant execute on function public.max_claimed_companies() to authenticated;

-- -----------------------------------------------------------------------------
-- claim_company: admin o collaboratore (sé stesso), con limite per collaboratore
-- -----------------------------------------------------------------------------

create or replace function public.claim_company(p_id uuid)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_active_user();
  v_admin boolean := public.is_admin();
  v_company public.companies%rowtype;
  v_updated int;
  v_claimed int;
  v_max int := public.max_claimed_companies();
begin
  select * into v_company from public.companies where id = p_id for update;
  if not found then
    raise exception 'Azienda non trovata';
  end if;

  if v_company.assigned_to = v_uid then
    return v_company;
  end if;

  if v_company.assigned_to is not null then
    raise exception 'Questa azienda è già assegnata a un altro';
  end if;

  if not v_admin then
    select count(*)::int into v_claimed
    from public.companies
    where assigned_to = v_uid;
    if v_claimed >= v_max then
      raise exception 'Hai raggiunto il limite di % aziende in carico', v_max;
    end if;
  end if;

  update public.companies
  set assigned_to = v_uid
  where id = p_id
    and assigned_to is null;
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    raise exception 'Questa azienda è già assegnata a un altro';
  end if;

  select * into v_company from public.companies where id = p_id;
  return v_company;
end;
$$;

-- -----------------------------------------------------------------------------
-- release_company: admin qualsiasi; collaboratore solo le proprie senza esiti
-- -----------------------------------------------------------------------------

create or replace function public.release_company(p_id uuid)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_active_user();
  v_admin boolean := public.is_admin();
  v_company public.companies%rowtype;
begin
  select * into v_company from public.companies where id = p_id for update;
  if not found then
    raise exception 'Azienda non trovata';
  end if;

  if not v_admin then
    if v_company.assigned_to is distinct from v_uid then
      raise exception 'Puoi rilasciare solo le aziende assegnate a te';
    end if;
    if exists (select 1 from public.call_logs where company_id = p_id) then
      raise exception 'Non puoi rilasciare un’azienda su cui hai già registrato esiti';
    end if;
  end if;

  update public.companies
  set assigned_to = null
  where id = p_id
  returning * into v_company;

  return v_company;
end;
$$;

-- -----------------------------------------------------------------------------
-- record_call_outcome: rispetta anche il limite claim automatico
-- -----------------------------------------------------------------------------

create or replace function public.record_call_outcome(
  p_company_id uuid,
  p_outcome text,
  p_note text default null,
  p_callback_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_active_user();
  v_admin boolean := public.is_admin();
  v_company public.companies%rowtype;
  v_log public.call_logs%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_callback timestamptz := null;
  v_updated int;
  v_claimed int;
  v_max int := public.max_claimed_companies();
begin
  if p_outcome not in ('da_chiamare', 'non_risponde', 'da_richiamare', 'accettato', 'rifiutato', 'numero_errato') then
    raise exception 'Seleziona un esito valido';
  end if;
  if v_note is not null and char_length(v_note) > 2000 then
    raise exception 'La nota non può superare 2000 caratteri';
  end if;

  if p_outcome = 'da_richiamare' then
    if p_callback_at is null then
      raise exception 'Indica data e orario del richiamo';
    end if;
    if p_callback_at <= now() then
      raise exception 'Scegli una data e un orario futuri';
    end if;
    v_callback := p_callback_at;
  end if;

  select * into v_company from public.companies where id = p_company_id for update;
  if not found then
    raise exception 'Azienda non trovata';
  end if;

  if not v_admin then
    if v_company.assigned_to is null then
      select count(*)::int into v_claimed
      from public.companies
      where assigned_to = v_uid;
      if v_claimed >= v_max then
        raise exception 'Hai raggiunto il limite di % aziende in carico', v_max;
      end if;

      update public.companies
      set assigned_to = v_uid
      where id = p_company_id
        and assigned_to is null;
      get diagnostics v_updated = row_count;
      if v_updated = 0 then
        raise exception 'Questa azienda è già assegnata a un altro';
      end if;
      select * into v_company from public.companies where id = p_company_id for update;
    elsif v_company.assigned_to <> v_uid then
      raise exception 'Questa azienda è già assegnata a un altro';
    end if;
  end if;

  insert into public.call_logs (company_id, user_id, outcome, note, callback_at)
  values (p_company_id, v_uid, p_outcome, v_note, v_callback)
  returning * into v_log;

  update public.companies
  set status = p_outcome,
      callback_at = v_callback
  where id = p_company_id
  returning * into v_company;

  return jsonb_build_object(
    'company', to_jsonb(v_company),
    'log', to_jsonb(v_log)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- next_company_for_call: priorità richiami scaduti → oggi → riprovare → pool
-- -----------------------------------------------------------------------------

create or replace function public.next_company_for_call(p_skip uuid[] default '{}')
returns public.companies
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_active_user();
  v_admin boolean := public.is_admin();
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_day_start timestamptz := (v_today::timestamp at time zone 'Europe/Rome');
  v_day_end timestamptz := ((v_today + 1)::timestamp at time zone 'Europe/Rome');
  v_company public.companies%rowtype;
  v_skip uuid[] := coalesce(p_skip, '{}');
begin
  -- 1) Richiami scaduti (assegnati a me, o admin: tutti i miei/assegnati)
  select c.* into v_company
  from public.companies as c
  where c.status = 'da_richiamare'
    and c.callback_at is not null
    and c.callback_at < v_day_start
    and (v_admin or c.assigned_to = v_uid)
    and not (c.id = any (v_skip))
  order by c.callback_at asc, c.name asc
  limit 1;
  if found then return v_company; end if;

  -- 2) Richiami di oggi
  select c.* into v_company
  from public.companies as c
  where c.status = 'da_richiamare'
    and c.callback_at is not null
    and c.callback_at >= v_day_start
    and c.callback_at < v_day_end
    and (v_admin or c.assigned_to = v_uid)
    and not (c.id = any (v_skip))
  order by c.callback_at asc, c.name asc
  limit 1;
  if found then return v_company; end if;

  -- 3) Da riprovare (non risponde) — proprie o pool se collaboratore
  select c.* into v_company
  from public.companies as c
  where c.status = 'non_risponde'
    and (
      c.assigned_to = v_uid
      or (not v_admin and c.assigned_to is null)
      or v_admin
    )
    and not (c.id = any (v_skip))
  order by c.created_at asc, c.name asc
  limit 1;
  if found then return v_company; end if;

  -- 4) Nuove dal pool
  select c.* into v_company
  from public.companies as c
  where c.status = 'da_chiamare'
    and c.assigned_to is null
    and not (c.id = any (v_skip))
  order by c.created_at asc, c.name asc
  limit 1;
  if found then return v_company; end if;

  return null;
end;
$$;

revoke all on function public.next_company_for_call(uuid[]) from public, anon;
grant execute on function public.next_company_for_call(uuid[]) to authenticated;

-- -----------------------------------------------------------------------------
-- dashboard_stats: campi personali collaboratore
-- -----------------------------------------------------------------------------

create or replace function public.dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_active_user();
  v_admin boolean := public.is_admin();
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_day_start timestamptz := (v_today::timestamp at time zone 'Europe/Rome');
  v_day_end timestamptz := ((v_today + 1)::timestamp at time zone 'Europe/Rome');
  v_week_start date := v_today - ((extract(isodow from v_today)::int) - 1);
  v_week_start_ts timestamptz := (v_week_start::timestamp at time zone 'Europe/Rome');
  v_30d timestamptz := ((v_today - 30)::timestamp at time zone 'Europe/Rome');
  v_companies public.companies[];
  v_total int;
  v_assigned int;
  v_calls_today int;
  v_calls_week int;
  v_accepted_today int;
  v_rejected_today int;
  v_accepted_30 int;
  v_rejected_30 int;
  v_daily_goal int;
  v_claimed int;
  v_rate numeric;
begin
  if v_admin then
    v_companies := array(select c from public.companies as c);
  else
    v_companies := array(select c from public.companies as c where c.assigned_to = v_uid);
  end if;

  select count(*) into v_total from unnest(v_companies) as c;
  select count(*) into v_assigned from unnest(v_companies) as c where c.assigned_to is not null;

  select count(*) into v_calls_today
  from public.call_logs as l
  where l.created_at >= v_day_start
    and (v_admin or l.user_id = v_uid);

  select count(*) into v_calls_week
  from public.call_logs as l
  where l.created_at >= v_week_start_ts
    and (v_admin or l.user_id = v_uid);

  select count(*) into v_accepted_today
  from public.call_logs as l
  where l.created_at >= v_day_start
    and l.outcome = 'accettato'
    and l.user_id = v_uid;

  select count(*) into v_rejected_today
  from public.call_logs as l
  where l.created_at >= v_day_start
    and l.outcome = 'rifiutato'
    and l.user_id = v_uid;

  select count(*) into v_accepted_30
  from public.call_logs as l
  where l.created_at >= v_30d
    and l.outcome = 'accettato'
    and l.user_id = v_uid;

  select count(*) into v_rejected_30
  from public.call_logs as l
  where l.created_at >= v_30d
    and l.outcome = 'rifiutato'
    and l.user_id = v_uid;

  if (v_accepted_30 + v_rejected_30) = 0 then
    v_rate := null;
  else
    v_rate := round((v_accepted_30::numeric / (v_accepted_30 + v_rejected_30)::numeric) * 100);
  end if;

  select p.daily_goal into v_daily_goal from public.profiles as p where p.id = v_uid;
  v_daily_goal := coalesce(v_daily_goal, 30);

  select count(*)::int into v_claimed
  from public.companies
  where assigned_to = v_uid;

  return jsonb_build_object(
    'total', v_total,
    'assigned', v_assigned,
    'byStatus', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'status', s.status,
          'count', (
            select count(*)::int
            from unnest(v_companies) as c
            where c.status = s.status
          )
        )
        order by s.ord
      ), '[]'::jsonb)
      from (
        values
          (1, 'da_chiamare'),
          (2, 'non_risponde'),
          (3, 'da_richiamare'),
          (4, 'accettato'),
          (5, 'rifiutato'),
          (6, 'numero_errato')
      ) as s(ord, status)
    ),
    'callsToday', v_calls_today,
    'callsThisWeek', v_calls_week,
    'acceptedToday', v_accepted_today,
    'rejectedToday', v_rejected_today,
    'acceptanceRate30d', v_rate,
    'dailyGoal', v_daily_goal,
    'claimedCount', v_claimed,
    'claimLimit', public.max_claimed_companies(),
    'ranking', case
      when not v_admin then '[]'::jsonb
      else (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'user_id', p.id,
            'full_name', p.full_name,
            'accepted', coalesce(a.accepted, 0)
          )
          order by coalesce(a.accepted, 0) desc, p.full_name
        ), '[]'::jsonb)
        from public.profiles as p
        left join (
          select user_id, count(*)::int as accepted
          from public.call_logs
          where outcome = 'accettato'
          group by user_id
        ) as a on a.user_id = p.id
        where p.role = 'collaboratore'
      )
    end,
    'callbacksOverdue', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'callback_at', c.callback_at,
          'phone', c.phone
        )
        order by c.callback_at
      ), '[]'::jsonb)
      from unnest(v_companies) as c
      where c.status = 'da_richiamare'
        and c.callback_at is not null
        and c.callback_at < v_day_start
    ),
    'callbacksToday', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'callback_at', c.callback_at,
          'phone', c.phone
        )
        order by c.callback_at
      ), '[]'::jsonb)
      from unnest(v_companies) as c
      where c.status = 'da_richiamare'
        and c.callback_at is not null
        and c.callback_at >= v_day_start
        and c.callback_at < v_day_end
    ),
    'callbacksDueCount', (
      select count(*)::int
      from unnest(v_companies) as c
      where c.status = 'da_richiamare'
        and c.callback_at is not null
        and c.callback_at < v_day_end
    )
  );
end;
$$;
