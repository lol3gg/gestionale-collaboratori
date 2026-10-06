import { assertBookableSlot, explanationSlots, rangesOverlap, startOfLocalDay } from '../calendar'
import { findDuplicate, normalizeWebsite, validateCompanyDetails } from '../companies'
import { isRecord, parseProfile } from '../guards'
import { normalizeItalianPhone } from '../phone'
import { validateEmail, validateFullName, validateRole } from '../validators'
import type {
  Actor,
  CallLog,
  CallOutcomeInput,
  CallQueue,
  Collaborator,
  CollaboratorDraft,
  Company,
  CompanyDetails,
  CompanyDraft,
  CompanyNote,
  CompanyStatus,
  DuplicatePolicy,
  ExplanationBooking,
  BookExplanationInput,
  ImportCompanyRow,
  ImportResult,
  Profile,
} from '../../types'
import { COMPANY_STATUSES } from '../../types'
import { DEMO_STORE_KEY, DEMO_STORE_VERSION } from './ids'
import { createSeed } from './seed'

export type DemoStore = {
  version: number
  collaborators: Profile[]
  companies: Company[]
  callLogs: CallLog[]
  bookings: ExplanationBooking[]
}

let memory: DemoStore | null = null

function isCompanyStatus(value: unknown): value is CompanyStatus {
  return typeof value === 'string' && COMPANY_STATUSES.some((status) => status === value)
}

function parseNote(value: unknown): CompanyNote | null {
  if (!isRecord(value)) return null
  const id = value.id
  const authorId = value.author_id
  const authorName = value.author_name
  const body = value.body
  const createdAt = value.created_at
  if (
    typeof id !== 'string' ||
    typeof authorId !== 'string' ||
    typeof authorName !== 'string' ||
    typeof body !== 'string' ||
    typeof createdAt !== 'string'
  ) {
    return null
  }
  return { id, author_id: authorId, author_name: authorName, body, created_at: createdAt }
}

function parseCompany(value: unknown): Company | null {
  if (!isRecord(value)) return null
  const id = value.id
  const name = value.name
  const city = value.city
  const province = value.province
  const region = value.region
  const address = value.address
  const phone = value.phone
  const website = value.website
  const status = value.status
  const assigneeId = value.assignee_id
  const email = value.email
  const employees = value.employees
  const createdAt = value.created_at
  const callbackAt = value.callback_at
  const notes = value.notes
  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    typeof city !== 'string' ||
    typeof province !== 'string' ||
    typeof region !== 'string' ||
    !(address === null || typeof address === 'string') ||
    typeof phone !== 'string' ||
    typeof website !== 'string' ||
    !isCompanyStatus(status) ||
    !(assigneeId === null || typeof assigneeId === 'string') ||
    !(callbackAt === null || typeof callbackAt === 'string') ||
    !(email === null || typeof email === 'string') ||
    !(employees === null || (typeof employees === 'number' && Number.isInteger(employees))) ||
    typeof createdAt !== 'string' ||
    !Array.isArray(notes)
  ) {
    return null
  }
  const parsedNotes: CompanyNote[] = []
  for (const note of notes) {
    const parsed = parseNote(note)
    if (!parsed) return null
    parsedNotes.push(parsed)
  }
  return {
    id,
    name,
    city,
    province,
    region,
    address,
    phone,
    website,
    status,
    assignee_id: assigneeId,
    callback_at: callbackAt,
    email,
    employees,
    created_at: createdAt,
    notes: parsedNotes,
  }
}

function parseCallLog(value: unknown): CallLog | null {
  if (!isRecord(value)) return null
  const id = value.id
  const companyId = value.company_id
  const userId = value.user_id
  const outcome = value.outcome
  const note = value.note
  const callbackAt = value.callback_at
  const createdAt = value.created_at
  if (
    typeof id !== 'string' ||
    typeof companyId !== 'string' ||
    typeof userId !== 'string' ||
    !isCompanyStatus(outcome) ||
    !(note === null || typeof note === 'string') ||
    !(callbackAt === null || typeof callbackAt === 'string') ||
    typeof createdAt !== 'string'
  ) {
    return null
  }
  return {
    id,
    company_id: companyId,
    user_id: userId,
    outcome,
    note,
    callback_at: callbackAt,
    created_at: createdAt,
  }
}

function parseBooking(value: unknown): ExplanationBooking | null {
  if (!isRecord(value)) return null
  const id = value.id
  const companyId = value.company_id
  const userId = value.user_id
  const startsAt = value.starts_at
  const endsAt = value.ends_at
  const createdAt = value.created_at
  if (
    typeof id !== 'string' ||
    typeof companyId !== 'string' ||
    typeof userId !== 'string' ||
    typeof startsAt !== 'string' ||
    typeof endsAt !== 'string' ||
    typeof createdAt !== 'string'
  ) {
    return null
  }
  return { id, company_id: companyId, user_id: userId, starts_at: startsAt, ends_at: endsAt, created_at: createdAt }
}

function parseStore(value: unknown): DemoStore | null {
  if (!isRecord(value) || value.version !== DEMO_STORE_VERSION) return null
  if (
    !Array.isArray(value.collaborators) ||
    !Array.isArray(value.companies) ||
    !Array.isArray(value.callLogs) ||
    !Array.isArray(value.bookings)
  ) {
    return null
  }
  const collaborators: Profile[] = []
  for (const item of value.collaborators) {
    const profile = parseProfile(item)
    if (!profile) return null
    collaborators.push(profile)
  }
  const companies: Company[] = []
  for (const item of value.companies) {
    const company = parseCompany(item)
    if (!company) return null
    companies.push(company)
  }
  const callLogs: CallLog[] = []
  for (const item of value.callLogs) {
    const log = parseCallLog(item)
    if (!log) return null
    callLogs.push(log)
  }
  const bookings: ExplanationBooking[] = []
  for (const item of value.bookings) {
    const booking = parseBooking(item)
    if (!booking) return null
    bookings.push(booking)
  }
  return { version: DEMO_STORE_VERSION, collaborators, companies, callLogs, bookings }
}

function persist(store: DemoStore): void {
  memory = store
  try {
    localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store))
  } catch {
    // La sessione demo continua in memoria se il browser blocca localStorage.
  }
}

export function readStore(): DemoStore {
  if (memory?.version === DEMO_STORE_VERSION) return memory
  try {
    const raw = localStorage.getItem(DEMO_STORE_KEY)
    if (raw) {
      const parsed = parseStore(JSON.parse(raw) as unknown)
      if (parsed) {
        memory = parsed
        return parsed
      }
    }
  } catch {
    // Dati corrotti: si riparte dal seed.
  }
  const seed = createSeed()
  persist(seed)
  return seed
}

function cloneCompany(company: Company): Company {
  return { ...company, notes: company.notes.map((note) => ({ ...note })) }
}

function assignedCount(store: DemoStore, userId: string): number {
  return store.companies.filter((company) => company.assignee_id === userId).length
}

function callStats(store: DemoStore, userId: string): Pick<Collaborator, 'calls_total' | 'calls_accepted' | 'calls_rejected' | 'acceptance_rate'> {
  const logs = store.callLogs.filter((log) => log.user_id === userId)
  const accepted = logs.filter((log) => log.outcome === 'accettato').length
  const rejected = logs.filter((log) => log.outcome === 'rifiutato').length
  return {
    calls_total: logs.length,
    calls_accepted: accepted,
    calls_rejected: rejected,
    acceptance_rate: logs.length === 0 ? null : Math.round((accepted / logs.length) * 100),
  }
}

export function listCollaborators(): Collaborator[] {
  const store = readStore()
  return store.collaborators.map((profile) => ({
    ...profile,
    assigned_companies: assignedCount(store, profile.id),
    ...callStats(store, profile.id),
  }))
}

export function findCollaborator(id: string): Profile | null {
  const profile = readStore().collaborators.find((item) => item.id === id)
  return profile ? { ...profile } : null
}

export function listCompanies(assigneeId?: string): Company[] {
  const companies = readStore().companies
  const filtered = assigneeId ? companies.filter((company) => company.assignee_id === assigneeId) : companies
  return filtered.map(cloneCompany)
}

function assertDraft(input: CollaboratorDraft): CollaboratorDraft {
  const nameError = validateFullName(input.full_name)
  if (nameError) throw new Error(nameError)
  const emailError = validateEmail(input.email)
  if (emailError) throw new Error(emailError)
  const role = validateRole(input.role)
  if (!role) throw new Error('Seleziona un ruolo valido')
  return { full_name: input.full_name.trim(), email: input.email.trim().toLowerCase(), role }
}

export function createCollaboratorRecord(input: CollaboratorDraft): Collaborator {
  const draft = assertDraft(input)
  const store = readStore()
  const duplicate = store.collaborators.some((item) => item.email.toLowerCase() === draft.email)
  if (duplicate) throw new Error('Esiste già un collaboratore con questa email')
  const profile: Profile = {
    id: crypto.randomUUID(),
    full_name: draft.full_name,
    email: draft.email,
    role: draft.role,
    active: true,
    created_at: new Date().toISOString(),
  }
  persist({ ...store, collaborators: [...store.collaborators, profile] })
  return { ...profile, assigned_companies: 0, calls_total: 0, calls_accepted: 0, calls_rejected: 0, acceptance_rate: null }
}

export function updateCollaboratorRecord(userId: string, input: CollaboratorDraft, actorId: string): Collaborator {
  const draft = assertDraft(input)
  const store = readStore()
  const current = store.collaborators.find((item) => item.id === userId)
  if (!current) throw new Error('Utente non trovato')
  if (userId === actorId && draft.role !== current.role) {
    throw new Error('Non puoi modificare il tuo ruolo')
  }
  const duplicate = store.collaborators.some((item) => item.id !== userId && item.email.toLowerCase() === draft.email)
  if (duplicate) throw new Error('Esiste già un collaboratore con questa email')
  const next: Profile = { ...current, full_name: draft.full_name, email: draft.email, role: draft.role }
  persist({
    ...store,
    collaborators: store.collaborators.map((item) => (item.id === userId ? next : item)),
  })
  const saved = readStore()
  return { ...next, assigned_companies: assignedCount(saved, userId), ...callStats(saved, userId) }
}

export function setCollaboratorActiveRecord(userId: string, active: boolean, actorId: string): void {
  if (userId === actorId && !active) throw new Error('Non puoi disattivare il tuo account')
  const store = readStore()
  const current = store.collaborators.find((item) => item.id === userId)
  if (!current) throw new Error('Utente non trovato')
  persist({
    ...store,
    collaborators: store.collaborators.map((item) => (item.id === userId ? { ...item, active } : item)),
  })
}

function requireAdmin(actor: Actor): void {
  if (actor.role !== 'admin') throw new Error('Operazione riservata all’amministratore')
}

function requireCompany(store: DemoStore, id: string, actor: Actor): Company {
  const company = store.companies.find((item) => item.id === id)
  if (!company) throw new Error('Azienda non trovata')
  if (actor.role === 'collaboratore' && company.assignee_id !== actor.id) {
    throw new Error('Puoi lavorare solo sulle aziende assegnate a te')
  }
  return company
}

function assertAssignee(store: DemoStore, assigneeId: string | null): void {
  if (assigneeId === null) return
  const person = store.collaborators.find((item) => item.id === assigneeId)
  if (!person || !person.active || person.role !== 'collaboratore') {
    throw new Error('Seleziona un collaboratore attivo')
  }
}

function replaceCompany(store: DemoStore, next: Company): Company {
  persist({
    ...store,
    companies: store.companies.map((company) => (company.id === next.id ? next : company)),
  })
  return cloneCompany(next)
}

function assertDetails(details: CompanyDetails): CompanyDetails {
  const checked = validateCompanyDetails({
    name: details.name,
    phone: details.phone,
    email: details.email ?? '',
    website: details.website,
    address: details.address ?? '',
    city: details.city,
    province: details.province,
    region: details.region,
    employees: details.employees === null ? '' : String(details.employees),
  })
  if (!checked.details) {
    const message = Object.values(checked.errors)[0]
    throw new Error(message ?? 'Dati azienda non validi')
  }
  return checked.details
}

export function createCompanyRecord(input: CompanyDraft, actor: Actor): Company {
  requireAdmin(actor)
  const details = assertDetails(input)
  if (!isCompanyStatus(input.status)) throw new Error('Seleziona uno stato valido')
  const callbackAt = input.status === 'da_richiamare' ? assertCallback(input.callback_at ?? null) : null
  const store = readStore()
  assertAssignee(store, input.assignee_id)
  const company: Company = {
    ...details,
    id: crypto.randomUUID(),
    status: input.status,
    assignee_id: input.assignee_id,
    callback_at: callbackAt,
    created_at: new Date().toISOString(),
    notes: [],
  }
  persist({ ...store, companies: [...store.companies, company] })
  return cloneCompany(company)
}

export function updateCompanyDetailsRecord(id: string, details: CompanyDetails, actor: Actor): Company {
  requireAdmin(actor)
  const nextDetails = assertDetails(details)
  const store = readStore()
  const current = requireCompany(store, id, actor)
  return replaceCompany(store, { ...current, ...nextDetails })
}

export function setCompanyStatusRecord(id: string, status: CompanyStatus, actor: Actor): Company {
  if (status === 'da_richiamare') throw new Error('Imposta la data del richiamo sulla singola azienda')
  if (!isCompanyStatus(status)) throw new Error('Seleziona uno stato valido')
  return recordCallOutcomeRecord({ companyId: id, outcome: status, note: null, callbackAt: null }, actor).company
}

export function assignCompanyRecord(id: string, assigneeId: string | null, actor: Actor): Company {
  requireAdmin(actor)
  const store = readStore()
  const current = requireCompany(store, id, actor)
  assertAssignee(store, assigneeId)
  return replaceCompany(store, { ...current, assignee_id: assigneeId })
}

export function addCompanyNoteRecord(id: string, body: string, actor: Actor): CompanyNote {
  const text = body.trim()
  if (text.length < 2) throw new Error('Scrivi il testo della nota')
  if (text.length > 2000) throw new Error('La nota non può superare 2000 caratteri')
  const store = readStore()
  const current = requireCompany(store, id, actor)
  const note: CompanyNote = {
    id: crypto.randomUUID(),
    author_id: actor.id,
    author_name: actor.full_name,
    body: text,
    created_at: new Date().toISOString(),
  }
  replaceCompany(store, { ...current, notes: [...current.notes, note] })
  return { ...note }
}

export function deleteCompanyRecords(ids: string[], actor: Actor): void {
  requireAdmin(actor)
  if (ids.length === 0) throw new Error('Seleziona almeno un’azienda')
  const store = readStore()
  const missing = ids.filter((id) => !store.companies.some((company) => company.id === id))
  if (missing.length > 0) throw new Error('Azienda non trovata')
  const drop = new Set(ids)
  persist({
    ...store,
    companies: store.companies.filter((company) => !drop.has(company.id)),
    callLogs: store.callLogs.filter((log) => !drop.has(log.company_id)),
    bookings: store.bookings.filter((booking) => !drop.has(booking.company_id)),
  })
}

export function bulkAssignCompanyRecords(ids: string[], assigneeId: string | null, actor: Actor): void {
  requireAdmin(actor)
  if (ids.length === 0) throw new Error('Seleziona almeno un’azienda')
  const store = readStore()
  assertAssignee(store, assigneeId)
  const selected = new Set(ids)
  if (ids.some((id) => !store.companies.some((company) => company.id === id))) {
    throw new Error('Azienda non trovata')
  }
  persist({
    ...store,
    companies: store.companies.map((company) => (selected.has(company.id) ? { ...company, assignee_id: assigneeId } : company)),
  })
}

export function bulkSetCompanyStatusRecords(ids: string[], status: CompanyStatus, actor: Actor): void {
  requireAdmin(actor)
  if (status === 'da_richiamare') throw new Error('Imposta la data del richiamo sulla singola azienda')
  if (!isCompanyStatus(status)) throw new Error('Seleziona uno stato valido')
  if (ids.length === 0) throw new Error('Seleziona almeno un’azienda')
  const store = readStore()
  if (ids.some((id) => !store.companies.some((company) => company.id === id))) {
    throw new Error('Azienda non trovata')
  }
  for (const id of ids) {
    recordCallOutcomeRecord({ companyId: id, outcome: status, note: null, callbackAt: null }, actor)
  }
}

export function importCompanyRecords(rows: ImportCompanyRow[], policy: DuplicatePolicy, actor: Actor): ImportResult {
  requireAdmin(actor)
  const store = readStore()
  const companies = store.companies.map(cloneCompany)
  let imported = 0
  let updated = 0
  let skipped = 0
  const errors: ImportResult['errors'] = []

  for (const row of rows) {
    const checked = validateCompanyDetails({
      name: row.name,
      phone: row.phone,
      email: row.email ?? '',
      website: row.website,
      address: '',
      city: row.city,
      province: row.province,
      region: row.region,
      employees: row.employees === null ? '' : String(row.employees),
    })
    if (!checked.details) {
      errors.push({ line: row.line, message: Object.values(checked.errors)[0] ?? 'Riga non valida' })
      continue
    }
    const details = {
      ...checked.details,
      phone: normalizeItalianPhone(checked.details.phone),
      website: checked.details.website ? normalizeWebsite(checked.details.website) : '',
    }
    const hit = findDuplicate(companies, details)
    if (hit) {
      if (policy === 'skip') {
        skipped += 1
        continue
      }
      const position = companies.findIndex((company) => company.id === hit.match.id)
      const current = companies[position]
      if (!current) {
        errors.push({ line: row.line, message: 'Doppione non trovato' })
        continue
      }
      companies[position] = {
        ...current,
        name: details.name,
        city: details.city,
        province: details.province,
        region: details.region,
        phone: details.phone,
        email: details.email,
        website: details.website,
        employees: details.employees,
      }
      updated += 1
      continue
    }
    companies.push({
      ...details,
      id: crypto.randomUUID(),
      status: 'da_chiamare',
      assignee_id: null,
      callback_at: null,
      created_at: new Date().toISOString(),
      notes: [],
    })
    imported += 1
  }

  persist({ ...store, companies })
  return { imported, updated, skipped, errors }
}

function assertCallback(value: string | null): string {
  if (!value) throw new Error('Imposta la data e l’ora del richiamo')
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('Data del richiamo non valida')
  if (date.getTime() <= Date.now()) throw new Error('Scegli una data e un orario futuri')
  return date.toISOString()
}

export function recordCallOutcomeRecord(input: CallOutcomeInput, actor: Actor): { company: Company; log: CallLog } {
  if (!isCompanyStatus(input.outcome)) throw new Error('Seleziona un esito valido')
  const note = input.note?.trim() ?? ''
  if (note.length > 2000) throw new Error('La nota non può superare 2000 caratteri')
  const callbackAt = input.outcome === 'da_richiamare' ? assertCallback(input.callbackAt) : null
  const store = readStore()
  const current = store.companies.find((company) => company.id === input.companyId)
  if (!current) throw new Error('Azienda non trovata')
  let assigneeId = current.assignee_id
  if (actor.role === 'collaboratore') {
    if (assigneeId && assigneeId !== actor.id) {
      throw new Error('Questa azienda è assegnata a un altro collaboratore')
    }
    if (!assigneeId) assigneeId = actor.id
  }
  const log: CallLog = {
    id: crypto.randomUUID(),
    company_id: current.id,
    user_id: actor.id,
    outcome: input.outcome,
    note: note || null,
    callback_at: callbackAt,
    created_at: new Date().toISOString(),
  }
  const next: Company = { ...current, status: input.outcome, assignee_id: assigneeId, callback_at: callbackAt }
  persist({
    ...store,
    companies: store.companies.map((company) => (company.id === next.id ? next : company)),
    callLogs: [...store.callLogs, log],
  })
  return { company: cloneCompany(next), log: { ...log } }
}

export function undoCallRecord(logId: string, actor: Actor): Company {
  const store = readStore()
  const log = store.callLogs.find((item) => item.id === logId)
  if (!log) throw new Error('Chiamata non trovata')
  if (actor.role !== 'admin' && log.user_id !== actor.id) throw new Error('Puoi annullare solo le tue chiamate')
  const company = store.companies.find((item) => item.id === log.company_id)
  if (!company) throw new Error('Azienda non trovata')
  const history = store.callLogs
    .filter((item) => item.company_id === company.id)
    .sort((left, right) => left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id))
  const latest = history[history.length - 1]
  if (!latest || latest.id !== log.id) throw new Error('Puoi annullare solo l’ultima chiamata')
  const previous = history[history.length - 2]
  const status = previous?.outcome ?? 'da_chiamare'
  const next: Company = {
    ...company,
    status,
    callback_at: status === 'da_richiamare' ? previous?.callback_at ?? null : null,
  }
  persist({
    ...store,
    companies: store.companies.map((item) => (item.id === next.id ? next : item)),
    callLogs: store.callLogs.filter((item) => item.id !== log.id),
  })
  return cloneCompany(next)
}

export function claimCompanyRecord(id: string, actor: Actor): Company {
  const store = readStore()
  const current = store.companies.find((company) => company.id === id)
  if (!current) throw new Error('Azienda non trovata')
  if (current.assignee_id && current.assignee_id !== actor.id) {
    throw new Error('Questa azienda è già assegnata')
  }
  if (current.assignee_id === actor.id) return cloneCompany(current)
  return replaceCompany(store, { ...current, assignee_id: actor.id })
}

export function releaseCompanyRecord(id: string, actor: Actor): Company {
  requireAdmin(actor)
  const store = readStore()
  const current = store.companies.find((company) => company.id === id)
  if (!current) throw new Error('Azienda non trovata')
  return replaceCompany(store, { ...current, assignee_id: null })
}

export function callQueueRecord(actor: Actor): CallQueue {
  const store = readStore()
  const companies = store.companies
    .filter((company) => {
      if (!company.phone.trim()) return false
      if (actor.role === 'admin') return true
      return company.assignee_id === actor.id || company.assignee_id === null
    })
    .map(cloneCompany)
  const visible = new Set(
    companies.filter((company) => actor.role === 'admin' || company.assignee_id === actor.id).map((company) => company.id),
  )
  const logs = store.callLogs.filter((log) => visible.has(log.company_id)).map((log) => ({ ...log }))
  return { companies, logs }
}

export function callLogsRecord(companyId: string, actor: Actor): CallLog[] {
  const store = readStore()
  const company = store.companies.find((item) => item.id === companyId)
  if (!company) throw new Error('Azienda non trovata')
  if (actor.role === 'collaboratore' && company.assignee_id !== actor.id) {
    throw new Error('Puoi vedere le chiamate solo delle aziende assegnate a te')
  }
  return store.callLogs
    .filter((log) => log.company_id === companyId)
    .map((log) => ({ ...log }))
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
}

export function listCallLogs(): CallLog[] {
  return readStore().callLogs.map((log) => ({ ...log }))
}

function cloneBooking(booking: ExplanationBooking): ExplanationBooking {
  return { ...booking }
}

export function listExplanationBookingsRecord(): ExplanationBooking[] {
  return readStore().bookings.map(cloneBooking)
}

export function bookExplanationRecord(input: BookExplanationInput, actor: Actor): ExplanationBooking {
  const { starts, ends } = assertBookableSlot(input.startsAt)
  const store = readStore()
  const company = store.companies.find((item) => item.id === input.companyId)
  if (!company) throw new Error('Azienda non trovata')
  if (actor.role === 'collaboratore' && company.assignee_id !== actor.id) {
    throw new Error('Puoi prenotare solo per le aziende assegnate a te')
  }
  const nextStart = starts.getTime()
  const nextEnd = ends.getTime()
  const overlaps = store.bookings.some((booking) =>
    rangesOverlap(nextStart, nextEnd, new Date(booking.starts_at).getTime(), new Date(booking.ends_at).getTime()),
  )
  if (overlaps) throw new Error('Questo orario è già prenotato')
  const sameDay = store.bookings.filter((booking) =>
    isSameDay(new Date(booking.starts_at), starts),
  )
  if (sameDay.length >= explanationSlots().length) {
    throw new Error('Non ci sono altri posti in questa giornata')
  }
  const booking: ExplanationBooking = {
    id: crypto.randomUUID(),
    company_id: company.id,
    user_id: actor.id,
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    created_at: new Date().toISOString(),
  }
  persist({ ...store, bookings: [...store.bookings, booking] })
  return cloneBooking(booking)
}

function isSameDay(left: Date, right: Date): boolean {
  return startOfLocalDay(left).getTime() === startOfLocalDay(right).getTime()
}

export function cancelExplanationRecord(id: string, actor: Actor): void {
  const store = readStore()
  const booking = store.bookings.find((item) => item.id === id)
  if (!booking) throw new Error('Prenotazione non trovata')
  if (actor.role !== 'admin' && booking.user_id !== actor.id) {
    throw new Error('Puoi annullare solo le tue prenotazioni')
  }
  persist({ ...store, bookings: store.bookings.filter((item) => item.id !== id) })
}
