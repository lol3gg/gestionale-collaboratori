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
    'Password should be at least 6 characters': 'La password deve avere almeno 6 caratteri',
    'Password should be at least 8 characters': 'La password deve avere almeno 8 caratteri',
    'New password should be different from the old password': 'La nuova password deve essere diversa da quella attuale',
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

/** Mappa messaggi Postgres/RPC in italiano leggibile (pass-through se già in italiano). */
export function mapRpcError(message: string): string {
  const cleaned = message
    .replace(/^.*ERROR:\s*/i, '')
    .replace(/\s+CONTEXT:.*$/i, '')
    .replace(/^PGRST\d+:\s*/i, '')
    .trim()

  const known: Record<string, string> = {
    'JWT expired': 'Sessione scaduta. Accedi di nuovo',
    'Invalid JWT': 'Sessione non valida. Accedi di nuovo',
    'permission denied': 'Non hai i permessi per questa operazione',
    'new row violates row-level security policy': 'Non hai i permessi per questa operazione',
    'duplicate key value violates unique constraint': 'Esiste già un record con questi dati',
  }

  const lower = cleaned.toLowerCase()
  for (const [needle, label] of Object.entries(known)) {
    if (lower.includes(needle.toLowerCase())) return label
  }

  if (/già assegnata|non autenticato|profilo assente|disattivato|orario|prenot|annullare|azienda non|chiamata non|solo l’admin|solo l'admin|seleziona un esito|indica data|scegli una data|nota non può|policy non valida|rows deve|nome obbligatorio/i.test(cleaned)) {
    return cleaned
  }

  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Connessione non disponibile. Controlla la rete e riprova.'
  }

  return cleaned || 'Operazione non riuscita'
}

export function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Operazione non riuscita'
  const message = error.message
  if (/service[_-]?role|sb_secret_|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\./i.test(message)) {
    return 'Operazione non riuscita'
  }
  return mapRpcError(message)
}
