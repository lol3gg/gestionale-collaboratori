import type { UserRole } from '../types'

const KEY = 'devology_view_as_role'
const BYPASS_ROLE_KEY = 'devology_bypass_role'

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

/** Ruolo scelto in modalità senza login (obbligatorio per entrare). */
export function readBypassRole(): UserRole | null {
  try {
    const value = sessionStorage.getItem(BYPASS_ROLE_KEY)
    return value === 'collaboratore' || value === 'admin' ? value : null
  } catch {
    return null
  }
}

export function writeBypassRole(role: UserRole | null): void {
  try {
    if (!role) sessionStorage.removeItem(BYPASS_ROLE_KEY)
    else sessionStorage.setItem(BYPASS_ROLE_KEY, role)
  } catch {
    // ignore
  }
}
