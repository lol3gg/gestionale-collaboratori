import { invokeAdminUsers } from './adminUsers'
import type { CallTab } from './calls'
import { isRecord } from './guards'
import { mapCallLog, mapCompany, mapCompanyFromUnknown, type DbCompanyRow } from './mapCompany'
import { getSupabase } from './supabase'
import { mapAuthError, mapRpcError } from './validators'

/** Limite UI allineato a public.max_claimed_companies() (default 30). */
export const CLAIM_LIMIT = 30
import {
  COMPANY_STATUSES,
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
  type SavedSearch,
  type SavedSearchDraft,
  type SearchGeoOptions,
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
  searchGeo: (params?: { region?: string; province?: string }) =>
    ['search-geo', params?.region ?? 'all', params?.province ?? 'all'] as const,
}

function throwQuery(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(mapRpcError(error.message))
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
  throwQuery(error)

  const companies = ((data ?? []) as unknown as DbCompanyRow[]).map(mapCompany)
  const logs = await fetchLogsForCompanies(companies.map((c) => c.id))

  const filterRows = await db().from('companies').select('region, province, city')
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
  return fetchLogsForCompanies([companyId])
}

export async function recordCallOutcome(
  input: CallOutcomeInput,
  actor: Actor,
): Promise<{ company: Company; log: CallLog }> {
  void actor
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
  void actor
  const { data, error } = await db().rpc('claim_company', { p_id: id })
  throwQuery(error)
  const mapped = mapCompanyFromUnknown(data)
  return loadCompany(mapped.id).catch(() => mapped)
}

export async function releaseCompany(id: string, actor: Actor): Promise<Company> {
  void actor
  const { data, error } = await db().rpc('release_company', { p_id: id })
  throwQuery(error)
  const mapped = mapCompanyFromUnknown(data)
  return loadCompany(mapped.id).catch(() => mapped)
}

export async function getExplanationBookings(): Promise<ExplanationBooking[]> {
  const { data, error } = await db()
    .from('explanation_bookings')
    .select('id, company_id, user_id, starts_at, ends_at, created_at')
    .order('starts_at', { ascending: true })
  throwQuery(error)
  return data ?? []
}

export async function getExplanationExtraSlots(): Promise<ExplanationExtraSlot[]> {
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
  const { data: profiles, error } = await db()
    .from('profiles')
    .select('id, full_name, email, role, active, daily_goal, created_at')
    .order('full_name', { ascending: true })
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
  const { data, error } = await db().rpc('dashboard_stats')
  if (!error && isRecord(data)) return parseDashboardPayload(data)
  // RPC assente o non aggiornata sul progetto → fallback client
  return getDashboardStatsFallback(viewer)
}

function isCompanyStatus(value: unknown): value is CompanyStatus {
  return typeof value === 'string' && (COMPANY_STATUSES as readonly string[]).includes(value)
}

function mapSavedSearch(row: {
  id: string
  user_id: string
  name: string
  query: string
  region: string | null
  province: string | null
  city: string | null
  status: string | null
  created_at: string
}): SavedSearch {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    query: row.query ?? '',
    region: row.region,
    province: row.province,
    city: row.city,
    status: isCompanyStatus(row.status) ? row.status : null,
    created_at: row.created_at,
  }
}

export function savedSearchToListParams(search: Pick<SavedSearch, 'query' | 'region' | 'province' | 'city' | 'status'>): CompanyListParams {
  return {
    search: search.query || undefined,
    region: search.region ?? 'all',
    province: search.province ?? 'all',
    city: search.city ?? 'all',
    status: search.status ?? 'all',
  }
}

export async function getSavedSearches(): Promise<SavedSearch[]> {
  const { data, error } = await db()
    .from('searches')
    .select('id, user_id, name, query, region, province, city, status, created_at')
    .order('created_at', { ascending: false })
  throwQuery(error)
  return (data ?? []).map(mapSavedSearch)
}

export async function createSavedSearch(draft: SavedSearchDraft, actor: Actor): Promise<SavedSearch> {
  const { data, error } = await db()
    .from('searches')
    .insert({
      user_id: actor.id,
      name: draft.name.trim(),
      query: draft.query.trim(),
      region: draft.region,
      province: draft.province,
      city: draft.city,
      status: draft.status,
    })
    .select('id, user_id, name, query, region, province, city, status, created_at')
    .single()
  throwQuery(error)
  return mapSavedSearch(data)
}

export async function updateSavedSearch(id: string, draft: SavedSearchDraft): Promise<SavedSearch> {
  const { data, error } = await db()
    .from('searches')
    .update({
      name: draft.name.trim(),
      query: draft.query.trim(),
      region: draft.region,
      province: draft.province,
      city: draft.city,
      status: draft.status,
    })
    .eq('id', id)
    .select('id, user_id, name, query, region, province, city, status, created_at')
    .single()
  throwQuery(error)
  return mapSavedSearch(data)
}

export async function deleteSavedSearch(id: string): Promise<void> {
  const { error } = await db().from('searches').delete().eq('id', id)
  throwQuery(error)
}

export async function getSearchGeoOptions(params?: {
  region?: string
  province?: string
}): Promise<SearchGeoOptions> {
  const { data, error } = await db().from('companies').select('region, province, city')
  throwQuery(error)
  const rows = data ?? []
  const region = params?.region && params.region !== 'all' ? params.region : null
  const province = params?.province && params.province !== 'all' ? params.province : null
  return {
    regions: uniqueSorted(rows.map((r) => r.region).filter(Boolean)),
    provinces: uniqueSorted(
      rows.filter((r) => !region || r.region === region).map((r) => r.province).filter(Boolean),
    ),
    cities: uniqueSorted(
      rows
        .filter((r) => (!region || r.region === region) && (!province || r.province === province))
        .map((r) => r.city)
        .filter(Boolean),
    ),
  }
}
