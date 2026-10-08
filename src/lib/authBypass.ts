/** Imposta a `true` solo per anteprima UI senza sessione (i dati Supabase non caricano). */
export const AUTH_BYPASS = false

export const BYPASS_PROFILE = {
  id: '00000000-0000-4000-8000-000000000001',
  full_name: 'Anteprima',
  email: 'anteprima@local',
  role: 'admin' as const,
  active: true,
  daily_goal: 20,
  created_at: new Date(0).toISOString(),
}
