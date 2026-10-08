import type { CallLog, Company, CompanyNote, CompanyStatus } from '../types'
import { isRecord } from './guards'
import { isCompanyStatus } from './companies'

/** Riga DB companies (assigned_to) → modello app (assignee_id). Unico punto di mapping. */
export type DbCompanyRow = {
  id: string
  name: string
  phone: string
  email: string | null
  website: string
  address: string | null
  city: string
  province: string
  region: string
  employees: number | null
  status: string
  assigned_to: string | null
  callback_at: string | null
  created_at: string
  company_notes?: DbNoteRow[] | null
}

type DbNoteRow = {
  id: string
  author_id: string
  body: string
  created_at: string
  profiles?: { full_name: string } | { full_name: string }[] | null
}

function authorName(note: DbNoteRow): string {
  const profiles = note.profiles
  if (!profiles) return '—'
  if (Array.isArray(profiles)) return profiles[0]?.full_name ?? '—'
  return profiles.full_name || '—'
}

function mapNote(note: DbNoteRow): CompanyNote {
  return {
    id: note.id,
    author_id: note.author_id,
    author_name: authorName(note),
    body: note.body,
    created_at: note.created_at,
  }
}

export function mapCompany(row: DbCompanyRow): Company {
  const status: CompanyStatus = isCompanyStatus(row.status) ? row.status : 'da_chiamare'
  const notesRaw = row.company_notes ?? []
  const notes = [...notesRaw]
    .map(mapNote)
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    website: row.website,
    address: row.address,
    city: row.city,
    province: row.province,
    region: row.region,
    employees: row.employees,
    status,
    assignee_id: row.assigned_to,
    callback_at: row.callback_at,
    created_at: row.created_at,
    notes,
  }
}

export function mapCompanyFromUnknown(value: unknown): Company {
  if (!isRecord(value)) throw new Error('Risposta azienda non valida')
  return mapCompany(value as unknown as DbCompanyRow)
}

export function mapCallLog(row: {
  id: string
  company_id: string
  user_id: string
  outcome: string
  note: string | null
  callback_at: string | null
  created_at: string
}): CallLog {
  return {
    id: row.id,
    company_id: row.company_id,
    user_id: row.user_id,
    outcome: isCompanyStatus(row.outcome) ? row.outcome : 'da_chiamare',
    note: row.note,
    callback_at: row.callback_at,
    created_at: row.created_at,
  }
}
