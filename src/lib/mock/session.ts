import { isDemoMode } from '../demo'
import type { UserRole } from '../../types'
import { DEMO_ADMIN_ID, DEMO_MARCO_ID, DEMO_ROLE_KEY } from './ids'
import { findCollaborator } from './store'

export function demoUserId(role: UserRole): string {
  return role === 'admin' ? DEMO_ADMIN_ID : DEMO_MARCO_ID
}

export function isDemoRole(value: string | null): value is UserRole {
  return value === 'admin' || value === 'collaboratore'
}

export function readDemoRole(): UserRole | null {
  try {
    const value = localStorage.getItem(DEMO_ROLE_KEY)
    return isDemoRole(value) ? value : null
  } catch {
    return null
  }
}

export function writeDemoRole(role: UserRole): void {
  localStorage.setItem(DEMO_ROLE_KEY, role)
}

export function clearDemoRole(): void {
  localStorage.removeItem(DEMO_ROLE_KEY)
}

export function profileForDemoRole(role: UserRole) {
  if (!isDemoMode) return null
  const record = findCollaborator(demoUserId(role))
  if (!record || !record.active) return null
  return { ...record, role }
}
