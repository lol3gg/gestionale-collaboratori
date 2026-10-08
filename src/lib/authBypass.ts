/** `true` = niente login (anteprima aperta). Metti `false` per riattivare l’accesso. */
export const AUTH_BYPASS = true

export const BYPASS_PROFILE = {
  id: '00000000-0000-4000-8000-000000000001',
  full_name: 'Admin Demo',
  email: 'admin@demo.local',
  role: 'admin' as const,
  active: true,
  daily_goal: 20,
  created_at: new Date(0).toISOString(),
}
