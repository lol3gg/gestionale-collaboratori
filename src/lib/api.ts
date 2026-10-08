import { invokeAdminUsers } from './adminUsers'
import { AUTH_BYPASS } from './authBypass'
import type { CallTab } from './calls'
import {
  demoAssignCompany,
  demoClaimCompany,
  demoDeleteSavedSearch,
  demoGetCallLogs,
  demoGetCallQueue,
  demoGetCollaborators,
  demoGetCompanies,
  demoGetDashboardStats,
  demoGetSavedSearches,
  demoGetSearchGeo,
  demoRecordCall,
  demoReleaseCompany,
  demoSetStatus,
  isDemoMode,
} from './demoSeed'
import { isRecord } from './guards'
import { mapCallLog, mapCompany, mapCompanyFromUnknown, type DbCompanyRow } from './mapCompany'
import { getSupabase } from './supabase'
import { mapAuthError, mapRpcError } from './validators'

/** Limite UI allineato a public.max_claimed_companies() (default 30). */
export const CLAIM_LIMIT = 30
import {
  type Actor,
  type AddExplanationExtraSlotInput,
  type BookExplanationInput,
  type CallLog,
  type CallOutcomeInput,
  type CallQueue,
  type Collaborator,
  type CollaboratorDraft,
  type Company,
  type CompanyDetails,
  type CompanyDraft,
  type CompanyListParams,
  type CompanyListResult,
  type CompanyNote,
  type CompanyStatus,
  type CreateCollaboratorInput,
  type DashboardStats,
  type DashboardViewer,
  type DuplicatePolicy,
  type ExplanationBooking,
  type ExplanationExtraSlot,
  type ImportCompanyRow,
  type ImportResult,
  type AddSearchResultsResult,
  type BatchSummary,
  type CancelBatchResult,
  type PlacesEstimate,
  type PlacesSearch,
  type SearchCoverage,
  type SearchGeoOptions,
  type SearchJob,
  type SearchResultRow,
  type SearchStatus,
} from '../types'

const COMPANY_SELECT = `
  id, name, phone, email, website, address, city, province, region, employees,
  status, assigned_to, callback_at, created_at,
  company_notes ( id, author_id, body, created_at, profiles ( full_name ) )
`

const CLOSED_STATUSES: CompanyStatus[] = ['accettato', 'rifiutato', 'numero_errato']

export const queryKeys = {
  collaborators: ['collaborators'] as const,
  companies: (params?: CompanyListParams | string) =>
    ['companies', params ?? 'all'] as const,
  dashboard: (userId: string, role: DashboardViewer['role']) => ['dashboard', userId, role] as const,
  callQueue: (userId: string, params?: unknown) => ['call-queue', userId, params ?? 'default'] as const,
  callLogs: (companyId: string) => ['call-logs', companyId] as const,
  bookings: ['explanation-bookings'] as const,
  extraSlots: ['explanation-extra-slots'] as const,
  searches: ['searches'] as const,
  searchJob: (searchId: string) => ['search-job', searchId] as const,
  searchResults: (searchId: string) => ['search-results', searchId] as const,
  searchCoverage: (searchId: string) => ['search-coverage', searchId] as const,
  searchGeo: (params?: { country?: string; region?: string }) =>
    ['search-geo', params?.country ?? 'IT', params?.region ?? 'all'] as const,
}

function isAuthBlocked(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const msg = `${error.message ?? ''} ${error.code ?? ''}`.toLowerCase()
  return (
    msg.includes('permission denied') ||
    msg.includes('not authenticated') ||
    msg.includes('non autenticato') ||
    msg.includes('jwt') ||
    msg.includes('42501') ||
    msg.includes('pgrst301')
  )
}

function throwQuery(error: { message: string; code?: string } | null): asserts error is null {
  if (error) throw new Error(mapRpcError(error.message))
}

function allowEmptyOnBypass(error: { message?: string; code?: string } | null): boolean {
  return AUTH_BYPASS && isAuthBlocked(error)
}

function db() {
  return getSupabase()
}

function sortColumn(key: CompanyListParams['sortKey']): string {
  switch (key) {
    case 'assignee':
      return 'assigned_to'
    case 'created_at':
      return 'created_at'
    case 'employees':
      return 'employees'
    case 'status':
      return 'status'
    case 'email':
      return 'email'
    case 'phone':
      return 'phone'
    case 'website':
      return 'website'
    case 'city':
      return 'city'
    case 'province':
      return 'province'
    case 'name':
    default:
      return 'name'
  }
}

function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/,/g, ' ')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyListFilters(query: any, filter: CompanyListParams) {
  let q = query
  if (filter.search?.trim()) {
    const term = escapeIlike(filter.search.trim())
    q = q.or(`name.ilike.%${term}%,city.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`)
  }
  if (filter.status && filter.status !== 'all') {
    q = q.eq('status', filter.status)
  }
  if (filter.region && filter.region !== 'all') {
    q = q.eq('region', filter.region)
  }
  if (filter.province && filter.province !== 'all') {
    q = q.eq('province', filter.province)
  }
  if (filter.city && filter.city !== 'all') {
    q = q.eq('city', filter.city)
  }
  if (filter.assignee === 'none') {
    q = q.is('assigned_to', null)
  } else if (filter.assignee && filter.assignee !== 'all') {
    q = q.eq('assigned_to', filter.assignee)
  }
  if (filter.assigneeId) {
    q = q.eq('assigned_to', filter.assigneeId)
  }
  if (filter.phone === 'yes') {
    q = q.neq('phone', '')
  } else if (filter.phone === 'no') {
    q = q.eq('phone', '')
  }
  return q
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyCallTabFilter(query: any, tab: CallTab, userId: string, role: Actor['role']) {
  let q = query
  const closedList = `(${CLOSED_STATUSES.map((s) => `"${s}"`).join(',')})`
  if (tab === 'chiusi') {
    q = q.in('status', CLOSED_STATUSES)
  } else if (tab === 'mie') {
    q = q.eq('assigned_to', userId).not('status', 'in', closedList)
  } else {
    const status =
      tab === 'da_riprovare' ? 'non_risponde' : tab === 'da_richiamare' ? 'da_richiamare' : 'da_chiamare'
    q = q.eq('status', status)
    if (role === 'collaboratore') {
      q = q.is('assigned_to', null)
    } else {
      q = q.or(`assigned_to.is.null,assigned_to.neq.${userId}`)
    }
  }
  return q
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyGeoFilters(
  query: any,
  filters: { query?: string; region?: string; province?: string; city?: string },
) {
  let q = query
  if (filters.query?.trim()) q = q.ilike('name', `%${filters.query.trim()}%`)
  if (filters.region) q = q.eq('region', filters.region)
  if (filters.province) q = q.eq('province', filters.province)
  if (filters.city) q = q.eq('city', filters.city)
  return q
}

async function countForTab(
  actor: Actor,
  tab: CallTab,
  filters: { query?: string; region?: string; province?: string; city?: string },
): Promise<number> {
  let q = db().from('companies').select('id', { count: 'exact', head: true })
  q = applyCallTabFilter(q, tab, actor.id, actor.role)
  q = applyGeoFilters(q, filters)
  const { count, error } = await q
  if (allowEmptyOnBypass(error)) return 0
  throwQuery(error)
  return count ?? 0
}

async function fetchLogsForCompanies(companyIds: string[]): Promise<CallLog[]> {
  if (companyIds.length === 0) return []
  const { data, error } = await db()
    .from('call_logs')
    .select('id, company_id, user_id, outcome, note, callback_at, created_at')
    .in('company_id', companyIds)
    .order('created_at', { ascending: false })
  throwQuery(error)
  return (data ?? []).map(mapCallLog)
}

async function loadCompany(id: string): Promise<Company> {
  const { data, error } = await db().from('companies').select(COMPANY_SELECT).eq('id', id).single()
  throwQuery(error)
  return mapCompany(data as unknown as DbCompanyRow)
}

export async function getCompanies(filter?: CompanyListParams | { assigneeId?: string }): Promise<CompanyListResult> {
  if (isDemoMode()) return demoGetCompanies(filter)
  const params: CompanyListParams = { ...(filter ?? {}) }
  const paginated = typeof params.page === 'number' && typeof params.pageSize === 'number'

  let q = db().from('companies').select(COMPANY_SELECT, { count: 'exact' })
  q = applyListFilters(q, params)

  const sortKey = params.sortKey ?? 'name'
  const ascending = (params.sortDir ?? 'asc') === 'asc'
  q = q.order(sortColumn(sortKey), { ascending, nullsFirst: false })

  if (paginated) {
    const from = (params.page as number) * (params.pageSize as number)
    const to = from + (params.pageSize as number) - 1
    q = q.range(from, to)
  }

  const { data, error, count } = await q
  if (allowEmptyOnBypass(error)) return { companies: [], total: 0 }
  throwQuery(error)
  const companies = ((data ?? []) as unknown as DbCompanyRow[]).map(mapCompany)
  return { companies, total: count ?? companies.length }
}

export async function createCompany(input: CompanyDraft, actor: Actor): Promise<Company> {
  void actor
  const { data, error } = await db()
    .from('companies')
    .insert({
      name: input.name,
      phone: input.phone,
      email: input.email,
      website: input.website,
      address: input.address,
      city: input.city,
      province: input.province,
      region: input.region,
      employees: input.employees,
      status: input.status,
      assigned_to: input.assignee_id,
      callback_at: input.callback_at ?? null,
    })
    .select(COMPANY_SELECT)
    .single()
  throwQuery(error)
  return mapCompany(data as unknown as DbCompanyRow)
}

export async function updateCompany(id: string, details: CompanyDetails, actor: Actor): Promise<Company> {
  void actor
  const { data, error } = await db()
    .from('companies')
    .update({
      name: details.name,
      phone: details.phone,
      email: details.email,
      website: details.website,
      address: details.address,
      city: details.city,
      province: details.province,
      region: details.region,
      employees: details.employees,
    })
    .eq('id', id)
    .select(COMPANY_SELECT)
    .single()
  throwQuery(error)
  return mapCompany(data as unknown as DbCompanyRow)
}

export async function setCompanyStatus(id: string, status: CompanyStatus, actor: Actor): Promise<Company> {
  if (isDemoMode()) return demoSetStatus(id, status)
  void actor
  const patch: { status: CompanyStatus; callback_at?: null } = { status }
  if (status !== 'da_richiamare') patch.callback_at = null
  const { data, error } = await db()
    .from('companies')
    .update(patch)
    .eq('id', id)
    .select(COMPANY_SELECT)
    .single()
  throwQuery(error)
  return mapCompany(data as unknown as DbCompanyRow)
}

export async function assignCompany(id: string, assigneeId: string | null, actor: Actor): Promise<Company> {
  if (isDemoMode()) return demoAssignCompany(id, assigneeId)
  void actor
  const { data, error } = await db()
    .from('companies')
    .update({ assigned_to: assigneeId })
    .eq('id', id)
    .select(COMPANY_SELECT)
    .single()
  throwQuery(error)
  return mapCompany(data as unknown as DbCompanyRow)
}

export async function addCompanyNote(id: string, body: string, actor: Actor): Promise<CompanyNote> {
  const trimmed = body.trim()
  if (!trimmed) throw new Error('Inserisci una nota')
  const { data, error } = await db()
    .from('company_notes')
    .insert({ company_id: id, author_id: actor.id, body: trimmed })
    .select('id, author_id, body, created_at')
    .single()
  throwQuery(error)
  return {
    id: data.id,
    author_id: data.author_id,
    author_name: actor.full_name,
    body: data.body,
    created_at: data.created_at,
  }
}

export async function deleteCompanies(ids: string[], actor: Actor): Promise<void> {
  void actor
  if (ids.length === 0) return
  const { error } = await db().from('companies').delete().in('id', ids)
  throwQuery(error)
}

export async function bulkAssignCompanies(ids: string[], assigneeId: string | null, actor: Actor): Promise<void> {
  void actor
  if (ids.length === 0) return
  const { error } = await db().from('companies').update({ assigned_to: assigneeId }).in('id', ids)
  throwQuery(error)
}

export async function bulkSetCompanyStatus(ids: string[], status: CompanyStatus, actor: Actor): Promise<void> {
  void actor
  if (ids.length === 0) return
  const patch: { status: CompanyStatus; callback_at?: null } = { status }
  if (status !== 'da_richiamare') patch.callback_at = null
  const { error } = await db().from('companies').update(patch).in('id', ids)
  throwQuery(error)
}

export async function importCompanies(
  rows: ImportCompanyRow[],
  policy: DuplicatePolicy,
  actor: Actor,
): Promise<ImportResult> {
  void actor
  const { data, error } = await db().rpc('import_companies', {
    p_rows: rows,
    p_policy: policy,
  })
  throwQuery(error)
  if (!isRecord(data)) throw new Error('Risposta import non valida')
  const errorsRaw = Array.isArray(data.errors) ? data.errors : []
  return {
    imported: typeof data.imported === 'number' ? data.imported : 0,
    updated: typeof data.updated === 'number' ? data.updated : 0,
    skipped: typeof data.skipped === 'number' ? data.skipped : 0,
    errors: errorsRaw.filter(isRecord).map((item) => {
      const row = item as Record<string, unknown>
      return {
        line: typeof row.line === 'number' ? row.line : 0,
        message: typeof row.message === 'string' ? row.message : 'Errore',
      }
    }),
  }
}

export type CallQueueParams = {
  tab: CallTab
  query?: string
  region?: string
  province?: string
  city?: string
  offset?: number
  limit?: number
}

export async function getCallQueue(actor: Actor, params?: CallQueueParams): Promise<CallQueue> {
  if (isDemoMode()) {
    return demoGetCallQueue(actor.id, {
      tab: params?.tab,
      query: params?.query,
      region: params?.region,
      province: params?.province,
      city: params?.city,
      offset: params?.offset,
      limit: params?.limit,
    })
  }
  const tab = params?.tab ?? 'da_chiamare'
  const offset = params?.offset ?? 0
  const limit = params?.limit ?? 25
  const geo = {
    query: params?.query,
    region: params?.region,
    province: params?.province,
    city: params?.city,
  }

  const [counts, listResult] = await Promise.all([
    Promise.all(
      (['da_chiamare', 'da_riprovare', 'da_richiamare', 'mie', 'chiusi'] as CallTab[]).map(async (item) => {
        const count = await countForTab(actor, item, geo)
        return [item, count] as const
      }),
    ),
    (async () => {
      let q = db().from('companies').select(COMPANY_SELECT, { count: 'exact' })
      q = applyCallTabFilter(q, tab, actor.id, actor.role)
      q = applyGeoFilters(q, geo)
      if (tab === 'da_richiamare') {
        // Scaduti (timestamp più bassi) per primi
        q = q.order('callback_at', { ascending: true, nullsFirst: false })
      } else if (tab === 'da_riprovare') {
        q = q.order('created_at', { ascending: true })
      } else {
        q = q.order('name', { ascending: true })
      }
      q = q.range(offset, offset + limit - 1)
      return q
    })(),
  ])

  const { data, error, count } = listResult
  if (allowEmptyOnBypass(error)) {
    return {
      companies: [],
      logs: [],
      total: 0,
      counts: { da_chiamare: 0, da_riprovare: 0, da_richiamare: 0, mie: 0, chiusi: 0 },
      regions: [],
      provinces: [],
      cities: [],
    }
  }
  throwQuery(error)

  const companies = ((data ?? []) as unknown as DbCompanyRow[]).map(mapCompany)
  const logs = await fetchLogsForCompanies(companies.map((c) => c.id))

  const filterRows = await db().from('companies').select('region, province, city')
  if (allowEmptyOnBypass(filterRows.error)) {
    return {
      companies,
      logs,
      total: count ?? companies.length,
      counts: Object.fromEntries(counts) as CallQueue['counts'],
      regions: [],
      provinces: [],
      cities: [],
    }
  }
  throwQuery(filterRows.error)
  const regions = uniqueSorted((filterRows.data ?? []).map((r) => r.region).filter(Boolean))
  const provinces = uniqueSorted(
    (filterRows.data ?? [])
      .filter((r) => !geo.region || r.region === geo.region)
      .map((r) => r.province)
      .filter(Boolean),
  )
  const cities = uniqueSorted(
    (filterRows.data ?? [])
      .filter(
        (r) =>
          (!geo.region || r.region === geo.region) && (!geo.province || r.province === geo.province),
      )
      .map((r) => r.city)
      .filter(Boolean),
  )

  return {
    companies,
    logs,
    total: count ?? companies.length,
    counts: Object.fromEntries(counts) as CallQueue['counts'],
    regions,
    provinces,
    cities,
  }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'it'),
  )
}

export async function getCallLogs(companyId: string, actor: Actor): Promise<CallLog[]> {
  void actor
  if (isDemoMode()) return demoGetCallLogs(companyId)
  return fetchLogsForCompanies([companyId])
}

export async function recordCallOutcome(
  input: CallOutcomeInput,
  actor: Actor,
): Promise<{ company: Company; log: CallLog }> {
  if (isDemoMode()) {
    return demoRecordCall(input.companyId, actor.id, input.outcome, input.note, input.callbackAt)
  }
  const { data, error } = await db().rpc('record_call_outcome', {
    p_company_id: input.companyId,
    p_outcome: input.outcome,
    p_note: input.note,
    p_callback_at: input.callbackAt,
  })
  throwQuery(error)
  if (!isRecord(data) || !isRecord(data.company) || !isRecord(data.log)) {
    throw new Error('Risposta non valida')
  }
  const company = mapCompanyFromUnknown(data.company)
  const full = await loadCompany(company.id).catch(() => company)
  return { company: full, log: mapCallLog(data.log as Parameters<typeof mapCallLog>[0]) }
}

export async function undoCall(logId: string, actor: Actor): Promise<Company> {
  void actor
  const { data, error } = await db().rpc('undo_call', { p_log_id: logId })
  throwQuery(error)
  const mapped = mapCompanyFromUnknown(data)
  return loadCompany(mapped.id).catch(() => mapped)
}

export async function claimCompany(id: string, actor: Actor): Promise<Company> {
  if (isDemoMode()) return demoClaimCompany(id, actor.id)
  const { data, error } = await db().rpc('claim_company', { p_id: id })
  throwQuery(error)
  const mapped = mapCompanyFromUnknown(data)
  return loadCompany(mapped.id).catch(() => mapped)
}

export async function releaseCompany(id: string, actor: Actor): Promise<Company> {
  if (isDemoMode()) return demoReleaseCompany(id, actor.id, actor.role === 'admin')
  const { data, error } = await db().rpc('release_company', { p_id: id })
  throwQuery(error)
  const mapped = mapCompanyFromUnknown(data)
  return loadCompany(mapped.id).catch(() => mapped)
}

export async function getExplanationBookings(): Promise<ExplanationBooking[]> {
  if (isDemoMode()) return []
  const { data, error } = await db()
    .from('explanation_bookings')
    .select('id, company_id, user_id, starts_at, ends_at, created_at')
    .order('starts_at', { ascending: true })
  throwQuery(error)
  return data ?? []
}

export async function getExplanationExtraSlots(): Promise<ExplanationExtraSlot[]> {
  if (isDemoMode()) return []
  const { data, error } = await db()
    .from('explanation_extra_slots')
    .select('id, day, start_min, created_at')
    .order('day', { ascending: true })
    .order('start_min', { ascending: true })
  throwQuery(error)
  return (data ?? []).map((row) => ({
    id: row.id,
    date_key: row.day,
    start_min: row.start_min,
    created_at: row.created_at,
  }))
}

export async function bookExplanation(input: BookExplanationInput, actor: Actor): Promise<ExplanationBooking> {
  void actor
  const { data, error } = await db().rpc('book_explanation', {
    p_company_id: input.companyId,
    p_starts_at: input.startsAt,
  })
  throwQuery(error)
  return data as ExplanationBooking
}

export async function cancelExplanation(id: string, actor: Actor): Promise<void> {
  void actor
  const { error } = await db().from('explanation_bookings').delete().eq('id', id)
  throwQuery(error)
}

export async function addExplanationExtraSlot(
  input: AddExplanationExtraSlotInput,
  actor: Actor,
): Promise<ExplanationExtraSlot> {
  const { data, error } = await db()
    .from('explanation_extra_slots')
    .insert({ day: input.dateKey, start_min: input.startMin, created_by: actor.id })
    .select('id, day, start_min, created_at')
    .single()
  throwQuery(error)
  return {
    id: data.id,
    date_key: data.day,
    start_min: data.start_min,
    created_at: data.created_at,
  }
}

export async function removeExplanationExtraSlot(id: string, actor: Actor): Promise<void> {
  void actor
  const { error } = await db().from('explanation_extra_slots').delete().eq('id', id)
  throwQuery(error)
}

export async function getCollaborators(): Promise<Collaborator[]> {
  if (isDemoMode()) return demoGetCollaborators()
  const { data: profiles, error } = await db()
    .from('profiles')
    .select('id, full_name, email, role, active, daily_goal, created_at')
    .order('full_name', { ascending: true })
  if (allowEmptyOnBypass(error)) return []
  throwQuery(error)

  const ids = (profiles ?? []).map((p) => p.id)
  const assignedCounts = new Map<string, number>()
  const callStats = new Map<string, { total: number; accepted: number; rejected: number }>()

  if (ids.length > 0) {
    const { data: companies, error: companiesError } = await db()
      .from('companies')
      .select('assigned_to')
      .in('assigned_to', ids)
    throwQuery(companiesError)
    for (const row of companies ?? []) {
      if (!row.assigned_to) continue
      assignedCounts.set(row.assigned_to, (assignedCounts.get(row.assigned_to) ?? 0) + 1)
    }

    const { data: logs, error: logsError } = await db()
      .from('call_logs')
      .select('user_id, outcome')
      .in('user_id', ids)
    throwQuery(logsError)
    for (const log of logs ?? []) {
      const current = callStats.get(log.user_id) ?? { total: 0, accepted: 0, rejected: 0 }
      current.total += 1
      if (log.outcome === 'accettato') current.accepted += 1
      if (log.outcome === 'rifiutato') current.rejected += 1
      callStats.set(log.user_id, current)
    }
  }

  return (profiles ?? []).map((profile) => {
    const stats = callStats.get(profile.id) ?? { total: 0, accepted: 0, rejected: 0 }
    const decided = stats.accepted + stats.rejected
    return {
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      role: profile.role,
      active: profile.active,
      daily_goal: typeof profile.daily_goal === 'number' ? profile.daily_goal : 30,
      created_at: profile.created_at,
      assigned_companies: assignedCounts.get(profile.id) ?? 0,
      calls_total: stats.total,
      calls_accepted: stats.accepted,
      calls_rejected: stats.rejected,
      acceptance_rate: decided === 0 ? null : Math.round((stats.accepted / decided) * 100),
    }
  })
}

export async function createCollaborator(input: CollaboratorDraft & { password?: string }): Promise<Collaborator> {
  const password = input.password
  if (!password) throw new Error('Inserisci una password')
  const payload: CreateCollaboratorInput = {
    full_name: input.full_name,
    email: input.email,
    password,
    role: input.role,
  }
  await invokeAdminUsers({ action: 'create', ...payload })
  const people = await getCollaborators()
  const created = people.find((person) => person.email.toLowerCase() === input.email.toLowerCase())
  if (!created) throw new Error('Collaboratore creato ma non trovato in elenco')
  return created
}

export async function updateCollaborator(
  userId: string,
  input: CollaboratorDraft,
  actorId: string,
): Promise<Collaborator> {
  void actorId
  await invokeAdminUsers({
    action: 'update',
    user_id: userId,
    full_name: input.full_name,
    role: input.role,
  })
  if (typeof input.daily_goal === 'number') {
    const { error } = await db()
      .from('profiles')
      .update({ daily_goal: input.daily_goal })
      .eq('id', userId)
    throwQuery(error)
  }
  const people = await getCollaborators()
  const updated = people.find((person) => person.id === userId)
  if (!updated) throw new Error('Collaboratore non trovato')
  return updated
}

export async function getNextCompany(skipIds: string[] = []): Promise<Company | null> {
  const { data, error } = await db().rpc('next_company_for_call', {
    p_skip: skipIds,
  })
  throwQuery(error)
  if (!data) return null
  const mapped = mapCompanyFromUnknown(data)
  return loadCompany(mapped.id).catch(() => mapped)
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const client = db()
  const { data: userData, error: userError } = await client.auth.getUser()
  throwQuery(userError)
  const email = userData.user?.email
  if (!email) throw new Error('Sessione non valida')

  const { error: reauthError } = await client.auth.signInWithPassword({
    email,
    password: currentPassword,
  })
  if (reauthError) throw new Error(mapAuthError(reauthError.message) || 'Password attuale non corretta')

  const { error } = await client.auth.updateUser({ password: newPassword })
  throwQuery(error)
}

export async function setCollaboratorActive(userId: string, active: boolean, actorId: string): Promise<void> {
  void actorId
  await invokeAdminUsers({ action: 'set_active', user_id: userId, active })
}

function parseDashboardPayload(data: Record<string, unknown>): DashboardStats {
  const byStatusRaw = Array.isArray(data.byStatus) ? data.byStatus : []
  const rankingRaw = Array.isArray(data.ranking) ? data.ranking : []
  const overdueRaw = Array.isArray(data.callbacksOverdue) ? data.callbacksOverdue : []
  const todayRaw = Array.isArray(data.callbacksToday) ? data.callbacksToday : []
  const asRecord = (value: unknown): Record<string, unknown> | null => (isRecord(value) ? value : null)

  return {
    total: typeof data.total === 'number' ? data.total : 0,
    assigned: typeof data.assigned === 'number' ? data.assigned : 0,
    byStatus: byStatusRaw
      .map(asRecord)
      .filter((item): item is Record<string, unknown> => item !== null)
      .map((item) => ({
        status: (typeof item.status === 'string' ? item.status : 'da_chiamare') as CompanyStatus,
        count: typeof item.count === 'number' ? item.count : 0,
      })),
    callsToday: typeof data.callsToday === 'number' ? data.callsToday : 0,
    callsThisWeek: typeof data.callsThisWeek === 'number' ? data.callsThisWeek : 0,
    acceptedToday: typeof data.acceptedToday === 'number' ? data.acceptedToday : 0,
    rejectedToday: typeof data.rejectedToday === 'number' ? data.rejectedToday : 0,
    acceptanceRate30d:
      typeof data.acceptanceRate30d === 'number'
        ? data.acceptanceRate30d
        : data.acceptanceRate30d === null
          ? null
          : null,
    dailyGoal: typeof data.dailyGoal === 'number' ? data.dailyGoal : 30,
    claimedCount: typeof data.claimedCount === 'number' ? data.claimedCount : 0,
    claimLimit: typeof data.claimLimit === 'number' ? data.claimLimit : CLAIM_LIMIT,
    ranking: rankingRaw
      .map(asRecord)
      .filter((item): item is Record<string, unknown> => item !== null)
      .map((item) => ({
        user_id: typeof item.user_id === 'string' ? item.user_id : '',
        full_name: typeof item.full_name === 'string' ? item.full_name : '',
        accepted: typeof item.accepted === 'number' ? item.accepted : 0,
      })),
    callbacksOverdue: overdueRaw
      .map(asRecord)
      .filter((item): item is Record<string, unknown> => item !== null)
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id : '',
        name: typeof item.name === 'string' ? item.name : '',
        callback_at: typeof item.callback_at === 'string' ? item.callback_at : '',
        phone: typeof item.phone === 'string' ? item.phone : undefined,
      })),
    callbacksToday: todayRaw
      .map(asRecord)
      .filter((item): item is Record<string, unknown> => item !== null)
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id : '',
        name: typeof item.name === 'string' ? item.name : '',
        callback_at: typeof item.callback_at === 'string' ? item.callback_at : '',
        phone: typeof item.phone === 'string' ? item.phone : undefined,
      })),
    callbacksDueCount: typeof data.callbacksDueCount === 'number' ? data.callbacksDueCount : 0,
  }
}

async function getDashboardStatsFallback(viewer: DashboardViewer): Promise<DashboardStats> {
  let companiesQuery = db()
    .from('companies')
    .select('id, name, phone, status, assigned_to, callback_at')
  if (viewer.role !== 'admin') {
    companiesQuery = companiesQuery.eq('assigned_to', viewer.id)
  }
  const { data: companies, error: companiesError } = await companiesQuery
  if (allowEmptyOnBypass(companiesError)) {
    return {
      total: 0,
      assigned: 0,
      byStatus: [],
      callsToday: 0,
      callsThisWeek: 0,
      acceptedToday: 0,
      rejectedToday: 0,
      acceptanceRate30d: null,
      dailyGoal: 30,
      claimedCount: 0,
      claimLimit: CLAIM_LIMIT,
      ranking: [],
      callbacksOverdue: [],
      callbacksToday: [],
      callbacksDueCount: 0,
    }
  }
  throwQuery(companiesError)

  const rows = companies ?? []
  const statuses: CompanyStatus[] = [
    'da_chiamare',
    'non_risponde',
    'da_richiamare',
    'accettato',
    'rifiutato',
    'numero_errato',
  ]
  const now = new Date()
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(startOfDay)
  endOfDay.setDate(endOfDay.getDate() + 1)
  const startOfWeek = new Date(startOfDay)
  const day = (startOfWeek.getDay() + 6) % 7
  startOfWeek.setDate(startOfWeek.getDate() - day)

  const callbacksOverdue = rows
    .filter(
      (c) =>
        c.status === 'da_richiamare' &&
        typeof c.callback_at === 'string' &&
        new Date(c.callback_at) < startOfDay,
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      callback_at: c.callback_at as string,
      phone: c.phone || undefined,
    }))
  const callbacksToday = rows
    .filter((c) => {
      if (c.status !== 'da_richiamare' || typeof c.callback_at !== 'string') return false
      const at = new Date(c.callback_at)
      return at >= startOfDay && at < endOfDay
    })
    .map((c) => ({
      id: c.id,
      name: c.name,
      callback_at: c.callback_at as string,
      phone: c.phone || undefined,
    }))

  let logsQuery = db().from('call_logs').select('outcome, created_at, user_id').gte('created_at', startOfWeek.toISOString())
  if (viewer.role !== 'admin') logsQuery = logsQuery.eq('user_id', viewer.id)
  const { data: logs, error: logsError } = await logsQuery
  throwQuery(logsError)

  const callRows = logs ?? []
  const callsToday = callRows.filter((l) => new Date(l.created_at) >= startOfDay).length
  const acceptedToday = callRows.filter(
    (l) => l.outcome === 'accettato' && new Date(l.created_at) >= startOfDay,
  ).length
  const rejectedToday = callRows.filter(
    (l) => l.outcome === 'rifiutato' && new Date(l.created_at) >= startOfDay,
  ).length

  let dailyGoal = 30
  const { data: profile } = await db().from('profiles').select('*').eq('id', viewer.id).maybeSingle()
  if (profile && typeof (profile as { daily_goal?: unknown }).daily_goal === 'number') {
    dailyGoal = (profile as { daily_goal: number }).daily_goal
  }
  const claimedCount = rows.filter((c) => c.assigned_to === viewer.id).length

  return {
    total: rows.length,
    assigned: rows.filter((c) => c.assigned_to).length,
    byStatus: statuses.map((status) => ({
      status,
      count: rows.filter((c) => c.status === status).length,
    })),
    callsToday,
    callsThisWeek: callRows.length,
    acceptedToday,
    rejectedToday,
    acceptanceRate30d: null,
    dailyGoal,
    claimedCount,
    claimLimit: CLAIM_LIMIT,
    ranking: [],
    callbacksOverdue,
    callbacksToday,
    callbacksDueCount: callbacksOverdue.length + callbacksToday.length,
  }
}

export async function getDashboardStats(viewer: DashboardViewer): Promise<DashboardStats> {
  if (isDemoMode()) return demoGetDashboardStats(viewer.id, viewer.role)
  const { data, error } = await db().rpc('dashboard_stats')
  if (!error && isRecord(data)) return parseDashboardPayload(data)
  // RPC assente o non aggiornata sul progetto → fallback client
  return getDashboardStatsFallback(viewer)
}

const SEARCH_SELECT = `
  id, user_id, name, country, region, regions, provinces, keywords,
  max_requests, estimated_queries, estimated_cost_eur,
  actual_requests, results_count, added_count, auto_add_to_companies,
  import_batch_id, summary, status, error_message, created_at, completed_at
`

function mapBatchSummary(value: unknown): BatchSummary | null {
  if (!isRecord(value)) return null
  return {
    comuni_done: Number(value.comuni_done ?? 0),
    comuni_total: Number(value.comuni_total ?? 0),
    found: Number(value.found ?? 0),
    inserted: Number(value.inserted ?? 0),
    duplicates_safe: Number(value.duplicates_safe ?? 0),
    duplicates_doubtful: Number(value.duplicates_doubtful ?? 0),
    without_phone: Number(value.without_phone ?? 0),
    requests: Number(value.requests ?? 0),
    estimated_cost_eur: Number(value.estimated_cost_eur ?? 0),
  }
}

function isSearchStatus(value: unknown): value is SearchStatus {
  return (
    typeof value === 'string' &&
    [
      'draft',
      'queued',
      'running',
      'completed',
      'partial_error',
      'failed',
      'cancelled',
      'paused',
      'paused_limit',
    ].includes(value)
  )
}

function mapPlacesSearch(row: Record<string, unknown>): PlacesSearch {
  const regions = Array.isArray(row.regions)
    ? row.regions.map(String)
    : typeof row.region === 'string' && row.region
      ? [row.region]
      : []
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name ?? ''),
    country: String(row.country ?? 'IT'),
    region: typeof row.region === 'string' ? row.region : null,
    regions,
    provinces: Array.isArray(row.provinces) ? row.provinces.map(String) : [],
    keywords: Array.isArray(row.keywords) ? row.keywords.map(String) : [],
    max_requests: Number(row.max_requests ?? 100),
    estimated_queries: Number(row.estimated_queries ?? 0),
    estimated_cost_eur: Number(row.estimated_cost_eur ?? 0),
    actual_requests: Number(row.actual_requests ?? 0),
    results_count: Number(row.results_count ?? 0),
    added_count: Number(row.added_count ?? 0),
    auto_add_to_companies: Boolean(row.auto_add_to_companies),
    import_batch_id: typeof row.import_batch_id === 'string' ? row.import_batch_id : null,
    summary: mapBatchSummary(row.summary),
    status: isSearchStatus(row.status) ? row.status : 'draft',
    error_message: typeof row.error_message === 'string' ? row.error_message : null,
    created_at: String(row.created_at),
    completed_at: typeof row.completed_at === 'string' ? row.completed_at : null,
  }
}

function mapSearchJob(row: Record<string, unknown>): SearchJob {
  return {
    id: String(row.id),
    search_id: String(row.search_id),
    status: isSearchStatus(row.status) ? row.status : 'queued',
    total_queries: Number(row.total_queries ?? 0),
    completed_queries: Number(row.completed_queries ?? 0),
    cursor_offset: Number(row.cursor_offset ?? 0),
    batch_size: Number(row.batch_size ?? 10),
    request_count: Number(row.request_count ?? 0),
    saturated_cells: Number(row.saturated_cells ?? 0),
    pending_cells: Number(row.pending_cells ?? 0),
    comuni_total: Number(row.comuni_total ?? 0),
    comuni_done: Number(row.comuni_done ?? 0),
    pause_summary: typeof row.pause_summary === 'string' ? row.pause_summary : null,
    error_message: typeof row.error_message === 'string' ? row.error_message : null,
    updated_at: String(row.updated_at),
  }
}

function mapSearchResult(row: Record<string, unknown>): SearchResultRow {
  return {
    id: String(row.id),
    search_id: String(row.search_id),
    google_place_id: typeof row.google_place_id === 'string' ? row.google_place_id : null,
    name: String(row.name ?? ''),
    phone: String(row.phone ?? ''),
    phone_normalized: String(row.phone_normalized ?? ''),
    website: String(row.website ?? ''),
    address: typeof row.address === 'string' ? row.address : null,
    city: String(row.city ?? ''),
    province: String(row.province ?? ''),
    region: String(row.region ?? ''),
    country: String(row.country ?? 'IT'),
    business_status: typeof row.business_status === 'string' ? row.business_status : null,
    is_duplicate_in_db: Boolean(row.is_duplicate_in_db),
    is_duplicate_in_search: Boolean(row.is_duplicate_in_search),
    possible_duplicate: Boolean(row.possible_duplicate),
    similar_company_id: typeof row.similar_company_id === 'string' ? row.similar_company_id : null,
    discarded: Boolean(row.discarded),
    added_company_id: typeof row.added_company_id === 'string' ? row.added_company_id : null,
    auto_added: Boolean(row.auto_added),
    fetched_at: String(row.fetched_at),
    created_at: String(row.created_at),
  }
}

export async function getPlacesSearches(): Promise<PlacesSearch[]> {
  if (isDemoMode()) return demoGetSavedSearches()
  const { data, error } = await db()
    .from('searches')
    .select(SEARCH_SELECT)
    .order('created_at', { ascending: false })
  if (allowEmptyOnBypass(error)) return []
  throwQuery(error)
  return (data ?? []).map((row) => mapPlacesSearch(row as Record<string, unknown>))
}

export async function getPlacesSearch(id: string): Promise<PlacesSearch | null> {
  const { data, error } = await db().from('searches').select(SEARCH_SELECT).eq('id', id).maybeSingle()
  throwQuery(error)
  return data ? mapPlacesSearch(data as Record<string, unknown>) : null
}

export async function deletePlacesSearch(id: string): Promise<void> {
  if (isDemoMode()) {
    demoDeleteSavedSearch(id)
    return
  }
  const { error } = await db().from('searches').delete().eq('id', id)
  throwQuery(error)
}

export async function getSearchJob(searchId: string): Promise<SearchJob | null> {
  const { data, error } = await db()
    .from('search_jobs')
    .select(
      'id, search_id, status, total_queries, completed_queries, cursor_offset, batch_size, request_count, saturated_cells, pending_cells, comuni_total, comuni_done, pause_summary, error_message, updated_at',
    )
    .eq('search_id', searchId)
    .maybeSingle()
  throwQuery(error)
  return data ? mapSearchJob(data as Record<string, unknown>) : null
}

export async function getSearchCoverage(searchId: string): Promise<SearchCoverage | null> {
  const { data, error } = await db().rpc('get_search_coverage', { p_search_id: searchId })
  throwQuery(error)
  if (!isRecord(data) || data.error) return null
  const rawUncovered = Array.isArray(data.uncovered_comuni) ? data.uncovered_comuni : []
  const uncovered_comuni: SearchCoverage['uncovered_comuni'] = []
  for (const item of rawUncovered) {
    if (!isRecord(item)) continue
    uncovered_comuni.push({
      comune_id: String(item.comune_id ?? ''),
      name: String(item.name ?? ''),
      province: String(item.province ?? ''),
      population: typeof item.population === 'number' ? item.population : null,
      pending_cells: Number(item.pending_cells ?? 0),
    })
  }
  return {
    comuni_total: Number(data.comuni_total ?? 0),
    comuni_done: Number(data.comuni_done ?? 0),
    cells_total: Number(data.cells_total ?? 0),
    cells_done: Number(data.cells_done ?? 0),
    cells_pending: Number(data.cells_pending ?? 0),
    cells_saturo: Number(data.cells_saturo ?? 0),
    cells_manual_review: Number(data.cells_manual_review ?? 0),
    cells_error: Number(data.cells_error ?? 0),
    uncovered_comuni,
  }
}

export async function getSearchResults(searchId: string): Promise<SearchResultRow[]> {
  const { data, error } = await db()
    .from('search_results')
    .select('*')
    .eq('search_id', searchId)
    .order('created_at', { ascending: false })
  throwQuery(error)
  return (data ?? []).map((row) => mapSearchResult(row as Record<string, unknown>))
}

export async function discardSearchResults(ids: string[], discarded = true): Promise<void> {
  if (ids.length === 0) return
  const { error } = await db().from('search_results').update({ discarded }).in('id', ids)
  throwQuery(error)
}

export async function addSearchResultsToCompanies(ids: string[]): Promise<AddSearchResultsResult> {
  const { data, error } = await db().rpc('add_search_results_to_companies', { p_ids: ids })
  throwQuery(error)
  if (!isRecord(data)) {
    return { inserted: 0, duplicates: 0, doubtful: 0, skipped: 0, without_phone: 0 }
  }
  return {
    inserted: Number(data.inserted ?? 0),
    duplicates: Number(data.duplicates ?? 0),
    doubtful: Number(data.doubtful ?? 0),
    skipped: Number(data.skipped ?? 0),
    without_phone: Number(data.without_phone ?? 0),
  }
}

export async function estimatePlacesSearch(params: {
  regions: string[]
  keywords: string[]
}): Promise<PlacesEstimate> {
  const { data, error } = await db().rpc('estimate_places_search_regions', {
    p_regions: params.regions,
    p_keywords: params.keywords,
  })
  throwQuery(error)
  if (!isRecord(data)) {
    return { comuni: 0, keywords: 0, queries: 0, estimated_cost_eur: 0, cost_per_request_eur: 0.032 }
  }
  return {
    comuni: Number(data.comuni ?? 0),
    keywords: Number(data.keywords ?? 0),
    queries: Number(data.queries ?? 0),
    estimated_cost_eur: Number(data.estimated_cost_eur ?? 0),
    cost_per_request_eur: Number(data.cost_per_request_eur ?? 0.032),
  }
}

export async function cancelImportBatch(batchId: string): Promise<CancelBatchResult> {
  const { data, error } = await db().rpc('cancel_import_batch', { p_batch_id: batchId })
  throwQuery(error)
  if (!isRecord(data)) return { deleted: 0, kept: 0, kept_assigned: 0, kept_called: 0 }
  return {
    deleted: Number(data.deleted ?? 0),
    kept: Number(data.kept ?? 0),
    kept_assigned: Number(data.kept_assigned ?? 0),
    kept_called: Number(data.kept_called ?? 0),
  }
}

export async function getSearchGeoOptions(params?: {
  country?: string
  region?: string
}): Promise<SearchGeoOptions> {
  if (isDemoMode()) return demoGetSearchGeo(params)
  const country = params?.country && params.country !== 'all' ? params.country : 'IT'
  const region = params?.region && params.region !== 'all' ? params.region : null

  const { data: regionRows, error: regionErr } = await db()
    .from('comuni')
    .select('region')
    .eq('country', country)
  if (allowEmptyOnBypass(regionErr)) return { countries: ['IT'], regions: [], provinces: [] }
  throwQuery(regionErr)

  let provincesQuery = db().from('comuni').select('province').eq('country', country)
  if (region) provincesQuery = provincesQuery.eq('region', region)
  const { data: provinceRows, error: provinceErr } = await provincesQuery
  throwQuery(provinceErr)

  return {
    countries: ['IT'],
    regions: uniqueSorted((regionRows ?? []).map((r) => r.region).filter(Boolean)),
    provinces: uniqueSorted((provinceRows ?? []).map((r) => r.province).filter(Boolean)),
  }
}
