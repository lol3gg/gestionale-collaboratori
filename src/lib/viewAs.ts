import type { UserRole } from '../types'

const KEY = 'devology_view_as_role'

export function readViewAsRole(): UserRole | null {
  try {
    const value = sessionStorage.getItem(KEY)
    return value === 'collaboratore' || value === 'admin' ? value : null
  } catch {
    return null
  }
}

export function writeViewAsRole(role: UserRole | null): void {
  try {
    if (!role) sessionStorage.removeItem(KEY)
    else sessionStorage.setItem(KEY, role)
  } catch {
    // ignore
  }
}
