-- TEMP: accesso lettura anon per anteprima senza login.
-- Rimuovere / revertire quando si riattiva AUTH_BYPASS = false.

grant usage on schema public to anon;
grant select on table public.profiles to anon;
grant select on table public.companies to anon;
grant select on table public.company_notes to anon;
grant select on table public.call_logs to anon;
grant select on table public.searches to anon;
grant select on table public.explanation_bookings to anon;
grant select on table public.explanation_extra_slots to anon;

drop policy if exists temp_anon_companies_select on public.companies;
create policy temp_anon_companies_select
  on public.companies for select to anon using (true);

drop policy if exists temp_anon_profiles_select on public.profiles;
create policy temp_anon_profiles_select
  on public.profiles for select to anon using (true);

drop policy if exists temp_anon_notes_select on public.company_notes;
create policy temp_anon_notes_select
  on public.company_notes for select to anon using (true);

drop policy if exists temp_anon_call_logs_select on public.call_logs;
create policy temp_anon_call_logs_select
  on public.call_logs for select to anon using (true);

drop policy if exists temp_anon_searches_select on public.searches;
create policy temp_anon_searches_select
  on public.searches for select to anon using (true);

drop policy if exists temp_anon_bookings_select on public.explanation_bookings;
create policy temp_anon_bookings_select
  on public.explanation_bookings for select to anon using (true);

drop policy if exists temp_anon_slots_select on public.explanation_extra_slots;
create policy temp_anon_slots_select
  on public.explanation_extra_slots for select to anon using (true);
