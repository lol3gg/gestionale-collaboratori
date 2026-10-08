import type { CallTab } from './calls'
import { matchesCallTab } from './calls'
import { AUTH_BYPASS, BYPASS_PROFILE } from './authBypass'
import type {
  CallLog,
  CallQueue,
  Collaborator,
  Company,
  CompanyListParams,
  CompanyListResult,
  CompanyStatus,
  DashboardStats,
  SavedSearch,
  SearchGeoOptions,
} from '../types'

export const DEMO_ADMIN_ID = BYPASS_PROFILE.id
export const DEMO_MARCO_ID = '00000000-0000-4000-8000-000000000002'
export const DEMO_GIULIA_ID = '00000000-0000-4000-8000-000000000003'

const now = Date.now()
const hours = (n: number) => new Date(now + n * 3600_000).toISOString()
const daysAgo = (n: number) => new Date(now - n * 86400_000).toISOString()

function company(
  partial: Omit<Company, 'notes' | 'website' | 'address' | 'email' | 'employees'> &
    Partial<Pick<Company, 'notes' | 'website' | 'address' | 'email' | 'employees'>>,
): Company {
  return {
    website: '',
    address: null,
    email: null,
    employees: null,
    notes: [],
    ...partial,
  }
}

let companies: Company[] = [
  company({
    id: 'c-demo-01',
    name: 'Nord Soft Srl',
    phone: '02 1234567',
    email: 'info@nordsoft.it',
    city: 'Milano',
    province: 'MI',
    region: 'Lombardia',
    employees: 24,
    status: 'da_chiamare',
    assignee_id: null,
    callback_at: null,
    created_at: daysAgo(12),
  }),
  company({
    id: 'c-demo-02',
    name: 'Alpi Logistics',
    phone: '011 9876543',
    city: 'Torino',
    province: 'TO',
    region: 'Piemonte',
    employees: 60,
    status: 'non_risponde',
    assignee_id: DEMO_MARCO_ID,
    callback_at: null,
    created_at: daysAgo(9),
    notes: [
      {
        id: 'n-1',
        author_id: DEMO_MARCO_ID,
        author_name: 'Marco Rossi',
        body: 'Nessuna risposta, riprovare mattina.',
        created_at: daysAgo(1),
      },
    ],
  }),
  company({
    id: 'c-demo-03',
    name: 'Mediterraneo Food',
    phone: '081 445566',
    city: 'Napoli',
    province: 'NA',
    region: 'Campania',
    status: 'da_richiamare',
    assignee_id: DEMO_GIULIA_ID,
    callback_at: hours(-2),
    created_at: daysAgo(6),
  }),
  company({
    id: 'c-demo-04',
    name: 'Verde Energia Spa',
    phone: '06 778899',
    email: 'contatti@verdeenergia.it',
    city: 'Roma',
    province: 'RM',
    region: 'Lazio',
    employees: 110,
    status: 'accettato',
    assignee_id: DEMO_MARCO_ID,
    callback_at: null,
    created_at: daysAgo(20),
  }),
  company({
    id: 'c-demo-05',
    name: 'Blue Print Studio',
    phone: '',
    city: 'Bologna',
    province: 'BO',
    region: 'Emilia-Romagna',
    status: 'da_chiamare',
    assignee_id: null,
    callback_at: null,
    created_at: daysAgo(3),
  }),
  company({
    id: 'c-demo-06',
    name: 'Adriatico Servizi',
    phone: '071 334455',
    city: 'Ancona',
    province: 'AN',
    region: 'Marche',
    status: 'rifiutato',
    assignee_id: DEMO_GIULIA_ID,
    callback_at: null,
    created_at: daysAgo(15),
  }),
  company({
    id: 'c-demo-07',
    name: 'Lago Digitale',
    phone: '031 556677',
    city: 'Como',
    province: 'CO',
    region: 'Lombardia',
    status: 'da_richiamare',
    assignee_id: DEMO_ADMIN_ID,
    callback_at: hours(5),
    created_at: daysAgo(4),
  }),
  company({
    id: 'c-demo-08',
    name: 'Etna Tech',
    phone: '095 112233',
    city: 'Catania',
    province: 'CT',
    region: 'Sicilia',
    status: 'da_chiamare',
    assignee_id: null,
    callback_at: null,
    created_at: daysAgo(2),
  }),
]

let callLogs: CallLog[] = [
  {
    id: 'l-1',
    company_id: 'c-demo-02',
    user_id: DEMO_MARCO_ID,
    outcome: 'non_risponde',
    note: 'Segreteria',
    callback_at: null,
    created_at: daysAgo(1),
  },
  {
    id: 'l-2',
    company_id: 'c-demo-04',
    user_id: DEMO_MARCO_ID,
    outcome: 'accettato',
    note: 'Interessati a demo',
    callback_at: null,
    created_at: daysAgo(5),
  },
  {
    id: 'l-3',
    company_id: 'c-demo-06',
    user_id: DEMO_GIULIA_ID,
    outcome: 'rifiutato',
    note: 'Già forniti',
    callback_at: null,
    created_at: daysAgo(8),
  },
  {
    id: 'l-4',
    company_id: 'c-demo-03',
    user_id: DEMO_GIULIA_ID,
    outcome: 'da_richiamare',
    note: 'Richiamare dopo le 15',
    callback_at: hours(-2),
    created_at: daysAgo(2),
  },
]

let savedSearches: SavedSearch[] = [
  {
    id: 's-1',
    user_id: DEMO_ADMIN_ID,
    name: 'Lombardia da chiamare',
    query: '',
    region: 'Lombardia',
    province: null,
    city: null,
    status: 'da_chiamare',
    created_at: daysAgo(7),
  },
  {
    id: 's-2',
    user_id: DEMO_ADMIN_ID,
    name: 'Pool libero',
    query: '',
    region: null,
    province: null,
    city: null,
    status: 'da_chiamare',
    created_at: daysAgo(2),
  },
]

const collaboratorsBase: Collaborator[] = [
  {
    ...BYPASS_PROFILE,
    full_name: 'Admin Demo',
    email: 'admin@demo.local',
    assigned_companies: 0,
    calls_total: 0,
    calls_accepted: 0,
    calls_rejected: 0,
    acceptance_rate: null,
  },
  {
    id: DEMO_MARCO_ID,
    full_name: 'Marco Rossi',
    email: 'marco@demo.local',
    role: 'collaboratore',
    active: true,
    daily_goal: 25,
    created_at: daysAgo(40),
    assigned_companies: 0,
    calls_total: 0,
    calls_accepted: 0,
    calls_rejected: 0,
    acceptance_rate: null,
  },
  {
    id: DEMO_GIULIA_ID,
    full_name: 'Giulia Bianchi',
    email: 'giulia@demo.local',
    role: 'collaboratore',
    active: true,
    daily_goal: 20,
    created_at: daysAgo(30),
    assigned_companies: 0,
    calls_total: 0,
    calls_accepted: 0,
    calls_rejected: 0,
    acceptance_rate: null,
  },
]

export function isDemoMode(): boolean {
  return AUTH_BYPASS
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it'))
}

function enrichCollaborators(): Collaborator[] {
  return collaboratorsBase.map((person) => {
    const assigned = companies.filter((c) => c.assignee_id === person.id).length
    const logs = callLogs.filter((l) => l.user_id === person.id)
    const accepted = logs.filter((l) => l.outcome === 'accettato').length
    const rejected = logs.filter((l) => l.outcome === 'rifiutato').length
    const total = logs.length
    return {
      ...person,
      assigned_companies: assigned,
      calls_total: total,
      calls_accepted: accepted,
      calls_rejected: rejected,
      acceptance_rate: total > 0 ? Math.round((accepted / total) * 100) : null,
    }
  })
}

function filterCompanies(params: CompanyListParams): Company[] {
  let rows = [...companies]
  const search = params.search?.trim().toLowerCase()
  if (search) {
    rows = rows.filter((c) =>
      [c.name, c.city, c.phone, c.email ?? ''].some((value) => value.toLowerCase().includes(search)),
    )
  }
  if (params.status && params.status !== 'all') rows = rows.filter((c) => c.status === params.status)
  if (params.region && params.region !== 'all') rows = rows.filter((c) => c.region === params.region)
  if (params.province && params.province !== 'all') rows = rows.filter((c) => c.province === params.province)
  if (params.city && params.city !== 'all') rows = rows.filter((c) => c.city === params.city)
  if (params.assignee === 'none') rows = rows.filter((c) => c.assignee_id === null)
  else if (params.assignee && params.assignee !== 'all') {
    rows = rows.filter((c) => c.assignee_id === params.assignee)
  }
  if (params.assigneeId) rows = rows.filter((c) => c.assignee_id === params.assigneeId)
  if (params.phone === 'yes') rows = rows.filter((c) => c.phone.trim() !== '')
  if (params.phone === 'no') rows = rows.filter((c) => c.phone.trim() === '')

  const key = params.sortKey ?? 'name'
  const dir = params.sortDir === 'desc' ? -1 : 1
  rows.sort((a, b) => {
    const pick = (row: Company) => {
      if (key === 'assignee') return row.assignee_id ?? ''
      if (key === 'employees') return String(row.employees ?? '')
      if (key === 'status') return row.status
      if (key === 'created_at') return row.created_at
      if (key === 'city') return row.city
      if (key === 'province') return row.province
      if (key === 'phone') return row.phone
      if (key === 'email') return row.email ?? ''
      if (key === 'website') return row.website
      return row.name
    }
    return pick(a).localeCompare(pick(b), 'it') * dir
  })
  return rows
}

export function demoGetCompanies(filter?: CompanyListParams | { assigneeId?: string }): CompanyListResult {
  const params: CompanyListParams = { ...(filter ?? {}) }
  const rows = filterCompanies(params)
  const paginated = typeof params.page === 'number' && typeof params.pageSize === 'number'
  if (!paginated) return { companies: rows, total: rows.length }
  const from = (params.page as number) * (params.pageSize as number)
  return { companies: rows.slice(from, from + (params.pageSize as number)), total: rows.length }
}

export function demoGetCollaborators(): Collaborator[] {
  return enrichCollaborators()
}

export function demoGetSavedSearches(): SavedSearch[] {
  return [...savedSearches].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function demoGetSearchGeo(params?: { region?: string; province?: string }): SearchGeoOptions {
  const region = params?.region && params.region !== 'all' ? params.region : null
  const province = params?.province && params.province !== 'all' ? params.province : null
  return {
    regions: uniqueSorted(companies.map((c) => c.region)),
    provinces: uniqueSorted(
      companies.filter((c) => !region || c.region === region).map((c) => c.province),
    ),
    cities: uniqueSorted(
      companies
        .filter((c) => (!region || c.region === region) && (!province || c.province === province))
        .map((c) => c.city),
    ),
  }
}

export function demoGetCallQueue(
  userId: string,
  params?: { tab?: CallTab; query?: string; region?: string; province?: string; city?: string; offset?: number; limit?: number },
): CallQueue {
  const tab = params?.tab ?? 'da_chiamare'
  const offset = params?.offset ?? 0
  const limit = params?.limit ?? 25
  const q = params?.query?.trim().toLowerCase() ?? ''

  const matchGeo = (c: Company) => {
    if (q && ![c.name, c.city].some((v) => v.toLowerCase().includes(q))) return false
    if (params?.region && c.region !== params.region) return false
    if (params?.province && c.province !== params.province) return false
    if (params?.city && c.city !== params.city) return false
    return true
  }

  const tabs: CallTab[] = ['da_chiamare', 'da_riprovare', 'da_richiamare', 'mie', 'chiusi']
  const counts = Object.fromEntries(
    tabs.map((item) => [item, companies.filter((c) => matchGeo(c) && matchesCallTab(c, item, userId)).length]),
  ) as CallQueue['counts']

  let rows = companies.filter((c) => matchGeo(c) && matchesCallTab(c, tab, userId))
  if (tab === 'da_richiamare') {
    rows = [...rows].sort((a, b) => (a.callback_at ?? '').localeCompare(b.callback_at ?? ''))
  } else {
    rows = [...rows].sort((a, b) => a.name.localeCompare(b.name, 'it'))
  }
  const page = rows.slice(offset, offset + limit)
  const geo = demoGetSearchGeo({ region: params?.region, province: params?.province })
  return {
    companies: page,
    logs: callLogs.filter((l) => page.some((c) => c.id === l.company_id)),
    total: rows.length,
    counts,
    regions: geo.regions,
    provinces: geo.provinces,
    cities: geo.cities,
  }
}

export function demoGetDashboardStats(viewerId: string, role: 'admin' | 'collaboratore'): DashboardStats {
  const rows = role === 'admin' ? companies : companies.filter((c) => c.assignee_id === viewerId)
  const statuses: CompanyStatus[] = [
    'da_chiamare',
    'non_risponde',
    'da_richiamare',
    'accettato',
    'rifiutato',
    'numero_errato',
  ]
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(startOfDay)
  endOfDay.setDate(endOfDay.getDate() + 1)

  const logs = role === 'admin' ? callLogs : callLogs.filter((l) => l.user_id === viewerId)
  const callsToday = logs.filter((l) => new Date(l.created_at) >= startOfDay).length
  const acceptedToday = logs.filter((l) => l.outcome === 'accettato' && new Date(l.created_at) >= startOfDay).length
  const rejectedToday = logs.filter((l) => l.outcome === 'rifiutato' && new Date(l.created_at) >= startOfDay).length

  const callbacksOverdue = rows
    .filter((c) => c.status === 'da_richiamare' && c.callback_at && new Date(c.callback_at) < startOfDay)
    .map((c) => ({ id: c.id, name: c.name, callback_at: c.callback_at as string, phone: c.phone || undefined }))
  const callbacksToday = rows
    .filter((c) => {
      if (c.status !== 'da_richiamare' || !c.callback_at) return false
      const at = new Date(c.callback_at)
      return at >= startOfDay && at < endOfDay
    })
    .map((c) => ({ id: c.id, name: c.name, callback_at: c.callback_at as string, phone: c.phone || undefined }))

  const people = enrichCollaborators().filter((p) => p.role === 'collaboratore')
  return {
    total: rows.length,
    assigned: rows.filter((c) => c.assignee_id).length,
    byStatus: statuses.map((status) => ({ status, count: rows.filter((c) => c.status === status).length })),
    callsToday,
    callsThisWeek: logs.length,
    acceptedToday,
    rejectedToday,
    acceptanceRate30d: null,
    dailyGoal: enrichCollaborators().find((p) => p.id === viewerId)?.daily_goal ?? 30,
    claimedCount: companies.filter((c) => c.assignee_id === viewerId).length,
    claimLimit: 30,
    ranking: people.map((p) => ({ user_id: p.id, full_name: p.full_name, accepted: p.calls_accepted })),
    callbacksOverdue,
    callbacksToday,
    callbacksDueCount: callbacksOverdue.length + callbacksToday.length,
  }
}

export function demoFindCompany(id: string): Company | null {
  return companies.find((c) => c.id === id) ?? null
}

export function demoGetCallLogs(companyId: string): CallLog[] {
  return callLogs
    .filter((l) => l.company_id === companyId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function demoAssignCompany(id: string, assigneeId: string | null): Company {
  const idx = companies.findIndex((c) => c.id === id)
  if (idx < 0) throw new Error('Azienda non trovata')
  companies[idx] = { ...companies[idx], assignee_id: assigneeId }
  return companies[idx]
}

export function demoSetStatus(id: string, status: CompanyStatus): Company {
  const idx = companies.findIndex((c) => c.id === id)
  if (idx < 0) throw new Error('Azienda non trovata')
  companies[idx] = {
    ...companies[idx],
    status,
    callback_at: status === 'da_richiamare' ? companies[idx].callback_at : null,
  }
  return companies[idx]
}

export function demoClaimCompany(id: string, userId: string): Company {
  const current = demoFindCompany(id)
  if (!current) throw new Error('Azienda non trovata')
  if (current.assignee_id && current.assignee_id !== userId) {
    throw new Error('Questa azienda è già assegnata a un altro')
  }
  return demoAssignCompany(id, userId)
}

export function demoReleaseCompany(id: string, userId: string, isAdmin: boolean): Company {
  const current = demoFindCompany(id)
  if (!current) throw new Error('Azienda non trovata')
  if (!isAdmin && current.assignee_id !== userId) {
    throw new Error('Non puoi rilasciare questa azienda')
  }
  return demoAssignCompany(id, null)
}

export function demoCreateSavedSearch(draft: Omit<SavedSearch, 'id' | 'created_at'>): SavedSearch {
  const row: SavedSearch = {
    ...draft,
    id: `s-${Math.random().toString(36).slice(2, 9)}`,
    created_at: new Date().toISOString(),
  }
  savedSearches = [row, ...savedSearches]
  return row
}

export function demoUpdateSavedSearch(id: string, draft: Omit<SavedSearch, 'id' | 'created_at' | 'user_id'>): SavedSearch {
  const idx = savedSearches.findIndex((s) => s.id === id)
  if (idx < 0) throw new Error('Ricerca non trovata')
  savedSearches[idx] = { ...savedSearches[idx], ...draft }
  return savedSearches[idx]
}

export function demoDeleteSavedSearch(id: string): void {
  savedSearches = savedSearches.filter((s) => s.id !== id)
}

export function demoRecordCall(
  companyId: string,
  userId: string,
  outcome: CompanyStatus,
  note: string | null,
  callbackAt: string | null,
): { company: Company; log: CallLog } {
  const company = demoSetStatus(companyId, outcome)
  const withCallback =
    outcome === 'da_richiamare'
      ? demoAssignCompany(companyId, company.assignee_id ?? userId)
      : company
  const updated =
    outcome === 'da_richiamare'
      ? (() => {
          const idx = companies.findIndex((c) => c.id === companyId)
          companies[idx] = { ...companies[idx], callback_at: callbackAt, assignee_id: companies[idx].assignee_id ?? userId }
          return companies[idx]
        })()
      : withCallback
  const log: CallLog = {
    id: `l-${Math.random().toString(36).slice(2, 9)}`,
    company_id: companyId,
    user_id: userId,
    outcome,
    note,
    callback_at: callbackAt,
    created_at: new Date().toISOString(),
  }
  callLogs = [log, ...callLogs]
  return { company: updated, log }
}
