-- =============================================================================
-- HOTFIX SICUREZZA — da applicare PRIMA di mettere l'app online
-- 1) chiude l'accesso anonimo (policy "temp_anon_*" della migration anteprima)
-- 2) impedisce a un collaboratore di cambiarsi ruolo / stato / email / obiettivo
-- 3) toglie ad anon l'esecuzione di due funzioni della ricerca
-- =============================================================================

-- 1) Accesso anonimo: elimina tutte le policy temp_anon_* e i grant a anon
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public' and policyname like 'temp\_anon\_%' escape '\'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')
  loop
    execute format('revoke all on table public.%I from anon', r.relname);
  end loop;
end $$;

-- 2) Profili: un non-admin può modificare solo il proprio nome
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role / SQL editor / edge function admin: nessun utente JWT → consentito
  if auth.uid() is null then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;
  if new.id is distinct from old.id
     or new.role is distinct from old.role
     or new.active is distinct from old.active
     or new.email is distinct from old.email
     or new.created_at is distinct from old.created_at
     or new.daily_goal is distinct from old.daily_goal then
    raise exception 'Operazione non consentita';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_update on public.profiles;
create trigger guard_profile_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

revoke all on function public.guard_profile_update() from public, anon, authenticated;

-- 3) Funzioni della ricerca: non eseguibili senza login
revoke execute on function public.estimate_places_search_regions(text[], text[], text[]) from public, anon;
revoke execute on function public.get_search_coverage(uuid) from public, anon;
