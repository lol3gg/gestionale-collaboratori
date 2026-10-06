import { COMPANY_STATUSES, type Company, type CompanyDetails, type CompanyStatus, type ImportCompanyRow, type ImportIssue } from '../types'
import type { CsvTable } from './csv'
import { normalizeItalianPhone, phonesMatch } from './phone'
import { validateEmail } from './validators'

export function normalizeWebsite(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function websiteHref(value: string): string {
  const normalized = normalizeWebsite(value)
  if (!normalized) return ''
  try {
    const url = new URL(normalized)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    return url.toString()
  } catch {
    return ''
  }
}

export function websiteLabel(value: string): string {
  const href = websiteHref(value)
  if (!href) return value
  try {
    return new URL(href).host.replace(/^www\./, '')
  } catch {
    return value
  }
}

function fold(value: string): string {
  return value.trim().toLocaleLowerCase('it').replace(/\s+/g, ' ')
}

export function sameNameAndCity(left: { name: string; city: string }, right: { name: string; city: string }): boolean {
  return fold(left.name) === fold(right.name) && fold(left.city) === fold(right.city)
}

export type CompanyFormInput = {
  name: string
  phone: string
  email: string
  website: string
  address: string
  city: string
  province: string
  region: string
  employees: string
}

export type CompanyFormErrors = Partial<Record<'name' | 'phone' | 'email' | 'website' | 'employees', string>>

export function parseEmployees(value: string): { value: number | null; error: string | null } {
  const trimmed = value.trim()
  if (!trimmed) return { value: null, error: null }
  if (!/^\d+$/.test(trimmed)) return { value: null, error: 'Inserisci un numero di dipendenti valido' }
  const parsed = Number(trimmed)
  if (parsed > 1_000_000) return { value: null, error: 'Il numero di dipendenti non è valido' }
  return { value: parsed, error: null }
}

export function validateCompanyDetails(input: CompanyFormInput): { details: CompanyDetails | null; errors: CompanyFormErrors } {
  const errors: CompanyFormErrors = {}
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (name.length < 2) errors.name = "Inserisci il nome dell'azienda"
  else if (name.length > 160) errors.name = 'Il nome non può superare 160 caratteri'

  const email = input.email.trim().toLowerCase()
  if (email && validateEmail(email)) errors.email = 'Inserisci un indirizzo email valido'

  const website = input.website.trim()
  if (website && !websiteHref(website)) errors.website = 'Inserisci un sito valido'

  const employees = parseEmployees(input.employees)
  if (employees.error) errors.employees = employees.error

  if (Object.keys(errors).length > 0) return { details: null, errors }

  return {
    details: {
      name,
      phone: normalizeItalianPhone(input.phone),
      email: email || null,
      website: website ? normalizeWebsite(website) : '',
      address: input.address.trim() || null,
      city: input.city.trim(),
      province: input.province.trim().toUpperCase(),
      region: input.region.trim(),
      employees: employees.value,
    },
    errors,
  }
}

export function isCompanyStatus(value: string): value is CompanyStatus {
  return COMPANY_STATUSES.some((status) => status === value)
}

type Identity = { name: string; city: string; phone: string }

export type DuplicateHit = {
  line: number
  name: string
  reason: 'nome_citta' | 'telefono'
  matchName: string
  matchCity: string
}

export function findDuplicate<T extends Identity>(
  existing: T[],
  row: Identity,
): { reason: DuplicateHit['reason']; match: T } | null {
  const byName = existing.find((item) => sameNameAndCity(item, row))
  if (byName) return { reason: 'nome_citta', match: byName }
  if (!row.phone.trim()) return null
  const byPhone = existing.find((item) => phonesMatch(item.phone, row.phone))
  if (byPhone) return { reason: 'telefono', match: byPhone }
  return null
}

export function duplicateReasonLabel(reason: DuplicateHit['reason']): string {
  return reason === 'nome_citta' ? 'Stesso nome e città' : 'Stesso telefono'
}

export const IMPORT_FIELDS = ['name', 'phone', 'email', 'website', 'city', 'province', 'region', 'employees'] as const

export type ImportField = (typeof IMPORT_FIELDS)[number]

export const importFieldLabel: Record<ImportField, string> = {
  name: 'Nome',
  phone: 'Telefono',
  email: 'Email',
  website: 'Sito',
  city: 'Città',
  province: 'Provincia',
  region: 'Regione',
  employees: 'Dipendenti',
}

const importAliases: Record<ImportField, string[]> = {
  name: ['nome', 'name', 'ragione sociale', 'azienda'],
  phone: ['telefono', 'tel', 'phone', 'cellulare'],
  email: ['email', 'e-mail', 'mail'],
  website: ['sito', 'sito web', 'website', 'url'],
  city: ['citta', 'città', 'city', 'comune'],
  province: ['provincia', 'prov', 'province'],
  region: ['regione', 'region'],
  employees: ['dipendenti', 'employees', 'n dipendenti', 'numero dipendenti'],
}

export type ColumnMapping = Record<ImportField, string>

export function emptyMapping(): ColumnMapping {
  return { name: '', phone: '', email: '', website: '', city: '', province: '', region: '', employees: '' }
}

export function guessMapping(headers: string[]): ColumnMapping {
  const mapping = emptyMapping()
  const used = new Set<string>()
  for (const field of IMPORT_FIELDS) {
    const header = headers.find((item) => !used.has(item) && importAliases[field].includes(fold(item)))
    if (header) {
      mapping[field] = header
      used.add(header)
    }
  }
  return mapping
}

function cellValue(table: CsvTable, row: CsvTable['rows'][number], header: string): string {
  if (!header) return ''
  const index = table.headers.indexOf(header)
  if (index < 0) return ''
  return row.cells[index]?.trim() ?? ''
}

export type PreparedImport = {
  rows: ImportCompanyRow[]
  errors: ImportIssue[]
  duplicates: DuplicateHit[]
}

export function prepareImport(table: CsvTable, mapping: ColumnMapping, existing: Company[]): PreparedImport {
  const rows: ImportCompanyRow[] = []
  const errors: ImportIssue[] = []
  for (const source of table.rows) {
    const name = cellValue(table, source, mapping.name).replace(/\s+/g, ' ').trim()
    const employeesRaw = cellValue(table, source, mapping.employees)
    const employees = parseEmployees(employeesRaw)
    const emailRaw = cellValue(table, source, mapping.email).toLowerCase()
    const websiteRaw = cellValue(table, source, mapping.website)
    if (name.length < 2) {
      errors.push({ line: source.line, message: 'Nome mancante' })
      continue
    }
    if (emailRaw && validateEmail(emailRaw)) {
      errors.push({ line: source.line, message: 'Email non valida' })
      continue
    }
    if (websiteRaw && !websiteHref(websiteRaw)) {
      errors.push({ line: source.line, message: 'Sito non valido' })
      continue
    }
    if (employees.error) {
      errors.push({ line: source.line, message: 'Dipendenti non validi' })
      continue
    }
    rows.push({
      line: source.line,
      name,
      phone: normalizeItalianPhone(cellValue(table, source, mapping.phone)),
      email: emailRaw || null,
      website: websiteRaw ? normalizeWebsite(websiteRaw) : '',
      city: cellValue(table, source, mapping.city),
      province: cellValue(table, source, mapping.province).toUpperCase(),
      region: cellValue(table, source, mapping.region),
      employees: employees.value,
    })
  }

  const pool: Identity[] = existing.map((company) => ({
    name: company.name,
    city: company.city,
    phone: company.phone,
  }))
  const duplicates: DuplicateHit[] = []
  for (const row of rows) {
    const hit = findDuplicate(pool, row)
    if (hit) {
      duplicates.push({
        line: row.line,
        name: row.name,
        reason: hit.reason,
        matchName: hit.match.name,
        matchCity: hit.match.city,
      })
    } else {
      pool.push(row)
    }
  }

  return { rows, errors, duplicates }
}

export type CompanySortKey =
  | 'name'
  | 'city'
  | 'province'
  | 'phone'
  | 'website'
  | 'email'
  | 'employees'
  | 'status'
  | 'assignee'
  | 'created_at'

export type CompanyListFilters = {
  search: string
  status: CompanyStatus | 'all'
  region: string
  province: string
  assignee: string
  phone: 'all' | 'yes' | 'no'
}

export function filterCompanies(companies: Company[], filters: CompanyListFilters): Company[] {
  const search = fold(filters.search)
  return companies.filter((company) => {
    if (search) {
      const haystack = `${fold(company.name)} ${fold(company.city)}`
      if (!haystack.includes(search)) return false
    }
    if (filters.status !== 'all' && company.status !== filters.status) return false
    if (filters.region !== 'all' && company.region !== filters.region) return false
    if (filters.province !== 'all' && company.province !== filters.province) return false
    if (filters.assignee === 'none' && company.assignee_id !== null) return false
    if (filters.assignee !== 'all' && filters.assignee !== 'none' && company.assignee_id !== filters.assignee) {
      return false
    }
    if (filters.phone === 'yes' && company.phone.trim() === '') return false
    if (filters.phone === 'no' && company.phone.trim() !== '') return false
    return true
  })
}

function statusRank(status: CompanyStatus): number {
  return COMPANY_STATUSES.indexOf(status)
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, 'it', { sensitivity: 'base' })
}

export function sortCompanies(
  companies: Company[],
  key: CompanySortKey,
  direction: 'asc' | 'desc',
  assigneeName: (id: string | null) => string,
): Company[] {
  const factor = direction === 'asc' ? 1 : -1
  const copy = [...companies]
  copy.sort((left, right) => {
    let result = 0
    if (key === 'employees') {
      if (left.employees === null && right.employees === null) result = 0
      else if (left.employees === null) return 1
      else if (right.employees === null) return -1
      else result = left.employees - right.employees
    } else if (key === 'created_at') {
      result = left.created_at.localeCompare(right.created_at)
    } else if (key === 'status') {
      result = statusRank(left.status) - statusRank(right.status)
    } else if (key === 'assignee') {
      result = compareText(assigneeName(left.assignee_id), assigneeName(right.assignee_id))
    } else if (key === 'email') {
      if (!left.email && !right.email) result = 0
      else if (!left.email) return 1
      else if (!right.email) return -1
      else result = compareText(left.email, right.email)
    } else {
      result = compareText(left[key], right[key])
    }
    return result * factor
  })
  return copy
}
