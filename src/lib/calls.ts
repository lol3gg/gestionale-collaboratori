import type { CallLog, Company, CompanyStatus } from '../types'

export type CallTab = 'da_chiamare' | 'da_riprovare' | 'da_richiamare' | 'mie' | 'chiusi'

export const CALL_TABS: { id: CallTab; label: string }[] = [
  { id: 'da_chiamare', label: 'Da chiamare' },
  { id: 'da_riprovare', label: 'Da riprovare' },
  { id: 'da_richiamare', label: 'Da richiamare' },
  { id: 'mie', label: 'Le mie' },
  { id: 'chiusi', label: 'Chiusi' },
]

const CLOSED: CompanyStatus[] = ['accettato', 'rifiutato', 'numero_errato']

export function latestUndoableLog(companyId: string, logs: CallLog[], userId: string, isAdmin: boolean): CallLog | null {
  const history = logs
    .filter((log) => log.company_id === companyId)
    .sort((left, right) => right.created_at.localeCompare(left.created_at) || right.id.localeCompare(left.id))
  const latest = history[0]
  if (!latest) return null
  if (!isAdmin && latest.user_id !== userId) return null
  return latest
}

export function companyCallHistory(companyId: string, logs: CallLog[]): CallLog[] {
  return logs
    .filter((log) => log.company_id === companyId)
    .sort((left, right) => right.created_at.localeCompare(left.created_at) || right.id.localeCompare(left.id))
}

/** Scheda primaria: mutua esclusione (Le mie non duplica le schede per stato). */
export function primaryCallTab(company: Company, userId: string): CallTab {
  if (CLOSED.includes(company.status)) return 'chiusi'
  if (company.assignee_id === userId) return 'mie'
  if (company.status === 'da_richiamare') return 'da_richiamare'
  if (company.status === 'non_risponde') return 'da_riprovare'
  return 'da_chiamare'
}

export function matchesCallTab(company: Company, tab: CallTab, userId: string): boolean {
  return primaryCallTab(company, userId) === tab
}

export function attemptsToday(companyId: string, logs: CallLog[]): number {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const from = start.getTime()
  return logs.filter(
    (log) =>
      log.company_id === companyId &&
      log.outcome === 'non_risponde' &&
      new Date(log.created_at).getTime() >= from,
  ).length
}

function lastWorkedAt(company: Company, logs: CallLog[]): string {
  const times = logs.filter((log) => log.company_id === company.id).map((log) => log.created_at)
  if (times.length === 0) return company.created_at
  return times.sort((left, right) => left.localeCompare(right)).at(-1) ?? company.created_at
}

/** Tentativo non_risponde più vecchio (o created_at azienda). */
function oldestRetryAttemptAt(company: Company, logs: CallLog[]): string {
  const times = logs
    .filter((log) => log.company_id === company.id && log.outcome === 'non_risponde')
    .map((log) => log.created_at)
    .sort((left, right) => left.localeCompare(right))
  return times[0] ?? company.created_at
}

export function sortCallQueue(companies: Company[], tab: CallTab, logs: CallLog[]): Company[] {
  const copy = [...companies]
  if (tab === 'da_richiamare') {
    copy.sort(
      (left, right) =>
        (left.callback_at ?? '').localeCompare(right.callback_at ?? '') ||
        left.name.localeCompare(right.name, 'it'),
    )
    return copy
  }
  if (tab === 'da_riprovare') {
    copy.sort(
      (left, right) =>
        oldestRetryAttemptAt(left, logs).localeCompare(oldestRetryAttemptAt(right, logs)) ||
        left.name.localeCompare(right.name, 'it'),
    )
    return copy
  }
  copy.sort(
    (left, right) =>
      lastWorkedAt(left, logs).localeCompare(lastWorkedAt(right, logs)) ||
      left.name.localeCompare(right.name, 'it'),
  )
  return copy
}

export type CallListFilters = {
  query: string
  region: string
  province: string
  city: string
}

export function filterCallCompanies(companies: Company[], filters: CallListFilters): Company[] {
  const query = filters.query.trim().toLocaleLowerCase('it')
  return companies.filter((company) => {
    if (filters.region && company.region !== filters.region) return false
    if (filters.province && company.province !== filters.province) return false
    if (filters.city && company.city !== filters.city) return false
    if (query && !company.name.toLocaleLowerCase('it').includes(query)) return false
    return true
  })
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim() !== ''))].sort((left, right) =>
    left.localeCompare(right, 'it'),
  )
}

export function callbackIso(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}
