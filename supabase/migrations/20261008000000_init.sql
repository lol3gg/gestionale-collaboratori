-- =============================================================================
-- Gestione Collaboratori — schema iniziale (unico)
-- Modello: companies.assigned_to (nessuna tabella company_assignments)
-- =============================================================================

create extension if not exists btree_gist;

-- -----------------------------------------------------------------------------
-- Helpers profilo
-- -----------------------------------------------------------------------------

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

create or replace function public.is_active_user()
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
      and active = true
  );
$$;

create or replace function public.require_active_user()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid := auth.uid();
begin
  if v_id is null then
    raise exception 'Non autenticato';
  end if;
  if not exists (
    select 1 from public.profiles where id = v_id and active = true
  ) then
    raise exception 'Profilo assente o disattivato';
  end if;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tabelle
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role text not null default 'collaboratore'
    constraint profiles_role_check check (role in ('admin', 'collaboratore')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index profiles_email_lower_idx
  on public.profiles (lower(email))
  where email <> '';

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null default '',
  email text,
  website text not null default '',
  address text,
  city text not null default '',
  province text not null default '',
  region text not null default '',
  country text not null default 'IT',
  employees integer,
  status text not null default 'da_chiamare'
    constraint companies_status_check check (
      status in ('da_chiamare', 'non_risponde', 'da_richiamare', 'accettato', 'rifiutato', 'numero_errato')
    ),
  assigned_to uuid references public.profiles (id) on delete set null,
  callback_at timestamptz,
  created_at timestamptz not null default now(),
  constraint companies_callback_check check (
    status <> 'da_richiamare' or callback_at is not null
  )
);

create unique index companies_phone_unique_idx
  on public.companies (phone)
  where phone <> '';

create index companies_name_idx on public.companies (name);
create index companies_region_idx on public.companies (region);
create index companies_province_idx on public.companies (province);
create index companies_city_idx on public.companies (city);
create index companies_status_idx on public.companies (status);
create index companies_assigned_to_idx on public.companies (assigned_to);

create table public.company_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete restrict,
  body text not null,
  created_at timestamptz not null default now(),
  constraint company_notes_body_check check (char_length(btrim(body)) between 1 and 2000)
);

create index company_notes_company_id_idx
  on public.company_notes (company_id, created_at desc);

create table public.call_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete restrict,
  outcome text not null
    constraint call_logs_outcome_check check (
      outcome in ('da_chiamare', 'non_risponde', 'da_richiamare', 'accettato', 'rifiutato', 'numero_errato')
    ),
  note text,
  callback_at timestamptz,
  created_at timestamptz not null default now(),
  constraint call_logs_note_check check (note is null or char_length(note) <= 2000),
  constraint call_logs_callback_check check (
    outcome <> 'da_richiamare' or callback_at is not null
  )
);

create index call_logs_company_id_idx on public.call_logs (company_id, created_at desc);
create index call_logs_user_id_idx on public.call_logs (user_id, created_at desc);

create table public.searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  query text not null default '',
  region text,
  province text,
  city text,
  status text,
  created_at timestamptz not null default now(),
  constraint searches_status_check check (
    status is null
    or status in ('da_chiamare', 'non_risponde', 'da_richiamare', 'accettato', 'rifiutato', 'numero_errato')
  )
);

create index searches_user_id_idx on public.searches (user_id, created_at desc);

create table public.explanation_bookings (
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
  constraint explanation_bookings_no_overlap
    exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&)
);

create index explanation_bookings_starts_at_idx on public.explanation_bookings (starts_at);

create table public.explanation_extra_slots (
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

create index explanation_extra_slots_day_idx on public.explanation_extra_slots (day);

-- -----------------------------------------------------------------------------
-- Trigger nuovo utente → profilo collaboratore
-- Il primo admin NON si crea da trigger. Dopo la registrazione:
--   update public.profiles
--   set role = 'admin'
--   where email = 'tua@email.it';
-- -----------------------------------------------------------------------------

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

-- -----------------------------------------------------------------------------
-- Utility telefono / slot
-- -----------------------------------------------------------------------------

create or replace function public.normalize_phone(raw text)
returns text
language plpgsql
immutable
as $$
declare
  trimmed text := trim(coalesce(raw, ''));
  digits text;
  national text;
begin
  if trimmed = '' then
    return '';
  end if;

  digits := regexp_replace(trimmed, '\D', '', 'g');
  if digits = '' then
    return '';
  end if;

  if left(trimmed, 1) = '+' then
    -- Estero (prefisso ≠ 39) o +39: conserva +cifre
    if left(digits, 2) = '39' and length(digits) >= 8 then
      national := substr(digits, 3);
      if left(national, 2) = '39' then
        national := substr(national, 3);
      end if;
      return '+39' || national;
    end if;
    return '+' || digits;
  end if;

  -- Nazionale / 0039 / 39…
  if left(digits, 4) = '0039' then
    digits := substr(digits, 5);
  elsif left(digits, 2) = '39' and length(digits) >= 8 then
    digits := substr(digits, 3);
  end if;

  return digits;
end;
$$;

create or replace function public.explanation_slot_is_valid(p_starts timestamptz)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_local timestamp;
  v_day date;
  v_start_min integer;
  v_default_start integer := 17 * 60 + 30; -- 17:30
  v_default_end integer := 19 * 60 + 30;   -- 19:30
begin
  if p_starts is null then
    return false;
  end if;
  if p_starts <= now() then
    return false;
  end if;

  v_local := p_starts at time zone 'Europe/Rome';
  v_day := v_local::date;
  v_start_min := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;

  -- Slot predefiniti 17:30–19:30 ogni 45 minuti
  if v_start_min >= v_default_start
     and v_start_min + 45 <= v_default_end
     and (v_start_min - v_default_start) % 45 = 0 then
    return true;
  end if;

  -- Slot extra admin
  return exists (
    select 1
    from public.explanation_extra_slots as s
    where s.day = v_day
      and s.start_min = v_start_min
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC
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

create or replace function public.undo_call(p_log_id uuid)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_active_user();
  v_admin boolean := public.is_admin();
  v_log public.call_logs%rowtype;
  v_company public.companies%rowtype;
  v_prev public.call_logs%rowtype;
  v_status text;
  v_callback timestamptz;
  v_release boolean := false;
begin
  select * into v_log from public.call_logs where id = p_log_id;
  if not found then
    raise exception 'Chiamata non trovata';
  end if;

  if not v_admin and v_log.user_id <> v_uid then
    raise exception 'Puoi annullare solo le tue chiamate';
  end if;

  select * into v_company from public.companies where id = v_log.company_id for update;
  if not found then
    raise exception 'Azienda non trovata';
  end if;

  if exists (
    select 1
    from public.call_logs as newer
    where newer.company_id = v_log.company_id
      and (
        newer.created_at > v_log.created_at
        or (newer.created_at = v_log.created_at and newer.id > v_log.id)
      )
  ) then
    raise exception 'Puoi annullare solo l’ultima chiamata';
  end if;

  select * into v_prev
  from public.call_logs
  where company_id = v_log.company_id
    and id <> v_log.id
  order by created_at desc, id desc
  limit 1;

  if found then
    v_status := v_prev.outcome;
    v_callback := case when v_prev.outcome = 'da_richiamare' then v_prev.callback_at else null end;
  else
    v_status := 'da_chiamare';
    v_callback := null;
    if v_company.assigned_to = v_log.user_id then
      v_release := true;
    end if;
  end if;

  delete from public.call_logs where id = v_log.id;

  update public.companies
  set status = v_status,
      callback_at = v_callback,
      assigned_to = case when v_release then null else assigned_to end
  where id = v_company.id
  returning * into v_company;

  return v_company;
end;
$$;

create or replace function public.claim_company(p_id uuid)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_active_user();
  v_company public.companies%rowtype;
  v_updated int;
begin
  if not public.is_admin() then
    raise exception 'Solo l’admin può assegnare aziende';
  end if;

  select * into v_company from public.companies where id = p_id for update;
  if not found then
    raise exception 'Azienda non trovata';
  end if;

  if v_company.assigned_to = v_uid then
    return v_company;
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

create or replace function public.release_company(p_id uuid)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company public.companies%rowtype;
begin
  perform public.require_active_user();
  if not public.is_admin() then
    raise exception 'Solo l’admin può liberare aziende';
  end if;

  update public.companies
  set assigned_to = null
  where id = p_id
  returning * into v_company;

  if not found then
    raise exception 'Azienda non trovata';
  end if;

  return v_company;
end;
$$;

create or replace function public.book_explanation(
  p_company_id uuid,
  p_starts_at timestamptz
)
returns public.explanation_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_active_user();
  v_admin boolean := public.is_admin();
  v_company public.companies%rowtype;
  v_booking public.explanation_bookings%rowtype;
begin
  select * into v_company from public.companies where id = p_company_id;
  if not found then
    raise exception 'Azienda non trovata';
  end if;

  if not v_admin and v_company.assigned_to <> v_uid then
    raise exception 'Puoi prenotare solo per le aziende assegnate a te';
  end if;

  if not public.explanation_slot_is_valid(p_starts_at) then
    raise exception 'Orario non disponibile';
  end if;

  insert into public.explanation_bookings (company_id, user_id, starts_at, ends_at)
  values (p_company_id, v_uid, p_starts_at, p_starts_at + interval '45 minutes')
  returning * into v_booking;

  return v_booking;
exception
  when exclusion_violation then
    raise exception 'Questo orario è già prenotato';
end;
$$;

create or replace function public.import_companies(
  p_rows jsonb,
  p_policy text default 'skip'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_active_user();
  v_row jsonb;
  v_line int;
  v_name text;
  v_phone text;
  v_email text;
  v_website text;
  v_address text;
  v_city text;
  v_province text;
  v_region text;
  v_country text;
  v_employees int;
  v_existing public.companies%rowtype;
  v_hit boolean;
  v_imported int := 0;
  v_updated int := 0;
  v_skipped int := 0;
  v_errors jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'Solo l’admin può importare aziende';
  end if;

  if p_policy not in ('skip', 'update') then
    raise exception 'Policy non valida (skip|update)';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows deve essere un array JSON';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    begin
      v_line := coalesce((v_row ->> 'line')::int, 0);
      v_name := btrim(coalesce(v_row ->> 'name', ''));
      v_phone := public.normalize_phone(coalesce(v_row ->> 'phone', ''));
      v_email := nullif(lower(btrim(coalesce(v_row ->> 'email', ''))), '');
      v_website := btrim(coalesce(v_row ->> 'website', ''));
      v_address := nullif(btrim(coalesce(v_row ->> 'address', '')), '');
      v_city := btrim(coalesce(v_row ->> 'city', ''));
      v_province := upper(btrim(coalesce(v_row ->> 'province', '')));
      v_region := btrim(coalesce(v_row ->> 'region', ''));
      v_country := coalesce(nullif(upper(btrim(coalesce(v_row ->> 'country', ''))), ''), 'IT');
      v_employees := null;

      if v_row ? 'employees' and nullif(v_row ->> 'employees', '') is not null then
        v_employees := (v_row ->> 'employees')::int;
      end if;

      if v_name = '' then
        raise exception 'Nome obbligatorio';
      end if;

      v_hit := false;
      if v_phone <> '' then
        select * into v_existing
        from public.companies
        where phone = v_phone
        limit 1;
        v_hit := found;
      end if;

      if v_hit then
        if p_policy = 'skip' then
          v_skipped := v_skipped + 1;
        else
          update public.companies
          set name = v_name,
              email = v_email,
              website = v_website,
              address = v_address,
              city = v_city,
              province = v_province,
              region = v_region,
              country = v_country,
              employees = v_employees
          where id = v_existing.id;
          v_updated := v_updated + 1;
        end if;
      else
        insert into public.companies (
          name, phone, email, website, address, city, province, region, country, employees
        ) values (
          v_name, v_phone, v_email, v_website, v_address, v_city, v_province, v_region, v_country, v_employees
        );
        v_imported := v_imported + 1;
      end if;
    exception
      when others then
        v_errors := v_errors || jsonb_build_array(
          jsonb_build_object('line', v_line, 'message', SQLERRM)
        );
    end;
  end loop;

  return jsonb_build_object(
    'imported', v_imported,
    'updated', v_updated,
    'skipped', v_skipped,
    'errors', v_errors
  );
end;
$$;

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
  v_companies public.companies[];
  v_total int;
  v_assigned int;
  v_calls_today int;
  v_calls_week int;
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
          'callback_at', c.callback_at
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
          'callback_at', c.callback_at
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

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_notes enable row level security;
alter table public.call_logs enable row level security;
alter table public.searches enable row level security;
alter table public.explanation_bookings enable row level security;
alter table public.explanation_extra_slots enable row level security;

-- profiles
create policy profiles_admin_all
  on public.profiles for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy profiles_select_active
  on public.profiles for select to authenticated
  using (public.is_active_user());

create policy profiles_update_own
  on public.profiles for update to authenticated
  using (public.is_active_user() and id = auth.uid())
  with check (public.is_active_user() and id = auth.uid());

-- companies: collaboratore solo SELECT (pool + sue); scritture solo admin / RPC
create policy companies_admin_all
  on public.companies for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy companies_select_assigned_or_pool
  on public.companies for select to authenticated
  using (
    public.is_active_user()
    and (assigned_to = auth.uid() or assigned_to is null)
  );

-- company_notes
create policy company_notes_admin_all
  on public.company_notes for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy company_notes_select_visible
  on public.company_notes for select to authenticated
  using (
    public.is_active_user()
    and exists (
      select 1 from public.companies as c
      where c.id = company_notes.company_id
        and (c.assigned_to = auth.uid() or c.assigned_to is null)
    )
  );

create policy company_notes_insert_own
  on public.company_notes for insert to authenticated
  with check (
    public.is_active_user()
    and author_id = auth.uid()
    and exists (
      select 1 from public.companies as c
      where c.id = company_notes.company_id
        and (c.assigned_to = auth.uid() or c.assigned_to is null)
    )
  );

-- call_logs: collaboratore solo SELECT sulle sue aziende; insert solo via RPC
create policy call_logs_admin_all
  on public.call_logs for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy call_logs_select_own_companies
  on public.call_logs for select to authenticated
  using (
    public.is_active_user()
    and exists (
      select 1 from public.companies as c
      where c.id = call_logs.company_id
        and c.assigned_to = auth.uid()
    )
  );

-- searches
create policy searches_admin_all
  on public.searches for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy searches_select_own
  on public.searches for select to authenticated
  using (public.is_active_user() and user_id = auth.uid());

create policy searches_insert_own
  on public.searches for insert to authenticated
  with check (public.is_active_user() and user_id = auth.uid());

create policy searches_update_own
  on public.searches for update to authenticated
  using (public.is_active_user() and user_id = auth.uid())
  with check (public.is_active_user() and user_id = auth.uid());

create policy searches_delete_own
  on public.searches for delete to authenticated
  using (public.is_active_user() and user_id = auth.uid());

-- explanation_bookings: visibili a tutti gli autenticati attivi;
-- create/annulla come proprietario o admin (insert anche via RPC)
create policy explanation_bookings_admin_all
  on public.explanation_bookings for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy explanation_bookings_select_authenticated
  on public.explanation_bookings for select to authenticated
  using (public.is_active_user());

create policy explanation_bookings_insert_own
  on public.explanation_bookings for insert to authenticated
  with check (
    public.is_active_user()
    and user_id = auth.uid()
    and exists (
      select 1 from public.companies as c
      where c.id = explanation_bookings.company_id
        and c.assigned_to = auth.uid()
    )
  );

create policy explanation_bookings_delete_own
  on public.explanation_bookings for delete to authenticated
  using (public.is_active_user() and user_id = auth.uid());

-- explanation_extra_slots
create policy explanation_extra_slots_select
  on public.explanation_extra_slots for select to authenticated
  using (public.is_active_user());

create policy explanation_extra_slots_admin_write
  on public.explanation_extra_slots for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Grants (nessun accesso anon)
-- -----------------------------------------------------------------------------

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.require_active_user() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_active_user() from public, anon;
revoke all on function public.normalize_phone(text) from public, anon;
revoke all on function public.explanation_slot_is_valid(timestamptz) from public, anon;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.normalize_phone(text) to authenticated;
grant execute on function public.explanation_slot_is_valid(timestamptz) to authenticated;

revoke all on function public.record_call_outcome(uuid, text, text, timestamptz) from public, anon;
revoke all on function public.undo_call(uuid) from public, anon;
revoke all on function public.claim_company(uuid) from public, anon;
revoke all on function public.release_company(uuid) from public, anon;
revoke all on function public.book_explanation(uuid, timestamptz) from public, anon;
revoke all on function public.import_companies(jsonb, text) from public, anon;
revoke all on function public.dashboard_stats() from public, anon;

grant execute on function public.record_call_outcome(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.undo_call(uuid) to authenticated;
grant execute on function public.claim_company(uuid) to authenticated;
grant execute on function public.release_company(uuid) to authenticated;
grant execute on function public.book_explanation(uuid, timestamptz) to authenticated;
grant execute on function public.import_companies(jsonb, text) to authenticated;
grant execute on function public.dashboard_stats() to authenticated;

revoke all on table public.profiles from anon, public;
revoke all on table public.companies from anon, public;
revoke all on table public.company_notes from anon, public;
revoke all on table public.call_logs from anon, public;
revoke all on table public.searches from anon, public;
revoke all on table public.explanation_bookings from anon, public;
revoke all on table public.explanation_extra_slots from anon, public;

-- Collaboratore: select (e note/searches/bookings dove previsto). No write su companies/call_logs.
grant select on public.profiles to authenticated;
grant select on public.companies to authenticated;
grant select, insert on public.company_notes to authenticated;
grant select on public.call_logs to authenticated;
grant select, insert, update, delete on public.searches to authenticated;
grant select, insert, delete on public.explanation_bookings to authenticated;
grant select on public.explanation_extra_slots to authenticated;

-- Admin scrive anche via policy; serve grant table-level
grant insert, update, delete on public.profiles to authenticated;
grant insert, update, delete on public.companies to authenticated;
grant update, delete on public.company_notes to authenticated;
grant insert, update, delete on public.call_logs to authenticated;
grant insert, update, delete on public.explanation_extra_slots to authenticated;

grant all on table public.profiles to service_role;
grant all on table public.companies to service_role;
grant all on table public.company_notes to service_role;
grant all on table public.call_logs to service_role;
grant all on table public.searches to service_role;
grant all on table public.explanation_bookings to service_role;
grant all on table public.explanation_extra_slots to service_role;
