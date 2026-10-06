import type { CallLog, Company, CompanyStatus } from '../types'

export type CallTab = 'da_chiamare' | 'da_richiamare' | 'mie' | 'chiusi'

const CLOSED: CompanyStatus[] = ['accettato', 'rifiutato', 'numero_errato']

export function matchesCallTab(company: Company, tab: CallTab, userId: string): boolean {
  if (tab === 'da_chiamare') return company.status === 'da_chiamare'
  if (tab === 'da_richiamare') return company.status === 'da_richiamare'
  if (tab === 'chiusi') return CLOSED.includes(company.status)
  return company.assignee_id === userId
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
