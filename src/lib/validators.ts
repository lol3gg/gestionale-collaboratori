import type { UserRole } from '../types'
import { isUserRole } from './guards'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type CollaboratorField = 'full_name' | 'email' | 'password' | 'role' | 'confirm'

export type FieldErrors = Partial<Record<CollaboratorField, string>>

export function validateFullName(value: string): string | null {
  const name = value.trim()
  if (name.length < 2) return 'Inserisci il nome completo'
  if (name.length > 120) return 'Il nome non può superare 120 caratteri'
  return null
}

export function validateEmail(value: string): string | null {
  const email = value.trim().toLowerCase()
  if (!emailPattern.test(email) || email.length > 254) {
    return 'Inserisci un indirizzo email valido'
  }
  return null
}

export function validatePassword(value: string): string | null {
  if (value.length < 8) return 'La password deve avere almeno 8 caratteri'
  if (value.length > 72) return 'La password non può superare 72 caratteri'
  return null
}

export function validateRole(value: string): UserRole | null {
  return isUserRole(value) ? value : null
}

export function mapAuthError(message: string): string {
  const known: Record<string, string> = {
    'Invalid login credentials': 'Email o password non corretti',
    'Email not confirmed': 'Email non confermata',
    'Too many requests': 'Troppi tentativi. Riprova tra poco',
  }
  return known[message] ?? 'Accesso non riuscito'
}

export function mapQueryError(message: string): string {
  const lower = message.toLowerCase()
  if (
    lower.includes('profiles') ||
    lower.includes('company_assignments') ||
    lower.includes('schema cache') ||
    lower.includes('relation')
  ) {
    return 'Impossibile leggere i dati. Verifica che la migrazione del database sia stata applicata.'
  }
  return 'Impossibile caricare i collaboratori'
}

export function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Operazione non riuscita'
  const message = error.message
  if (/service[_-]?role|sb_secret_|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\./i.test(message)) {
    return 'Operazione non riuscita'
  }
  return message
}
