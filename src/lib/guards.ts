import type { Profile, UserRole } from '../types'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isUserRole(value: unknown): value is UserRole {
  return value === 'admin' || value === 'collaboratore'
}

export function parseProfile(value: unknown): Profile | null {
  if (!isRecord(value)) return null
  const id = value.id
  const fullName = value.full_name
  const email = value.email
  const role = value.role
  const active = value.active
  const createdAt = value.created_at
  if (
    typeof id !== 'string' ||
    typeof fullName !== 'string' ||
    typeof email !== 'string' ||
    !isUserRole(role) ||
    typeof active !== 'boolean' ||
    typeof createdAt !== 'string'
  ) {
    return null
  }
  return {
    id,
    full_name: fullName,
    email,
    role,
    active,
    created_at: createdAt,
  }
}
