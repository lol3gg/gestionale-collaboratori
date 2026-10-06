import { isDemoMode } from './demo'
import {
  addCompanyNoteRecord,
  assignCompanyRecord,
  bulkAssignCompanyRecords,
  bulkSetCompanyStatusRecords,
  callLogsRecord,
  callQueueRecord,
  cancelExplanationRecord,
  claimCompanyRecord,
  createCollaboratorRecord,
  createCompanyRecord,
  deleteCompanyRecords,
  importCompanyRecords,
  listCallLogs,
  listCollaborators,
  listCompanies,
  listExplanationBookingsRecord,
  bookExplanationRecord,
  recordCallOutcomeRecord,
  releaseCompanyRecord,
  setCollaboratorActiveRecord,
  setCompanyStatusRecord,
  undoCallRecord,
  updateCollaboratorRecord,
  updateCompanyDetailsRecord,
} from './mock/store'
import { COMPANY_STATUSES } from '../types'
import type {
  Actor,
  CallLog,
  CallOutcomeInput,
  CallQueue,
  CallRankingRow,
  Collaborator,
  CollaboratorDraft,
  Company,
  CompanyDetails,
  CompanyDraft,
  CompanyFilter,
  CompanyNote,
  CompanyStatus,
  DashboardStats,
  DashboardViewer,
  DuplicatePolicy,
  ExplanationBooking,
  BookExplanationInput,
  ImportCompanyRow,
  ImportResult,
} from '../types'

const DEMO_DELAY_MS = 280

function wait(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, DEMO_DELAY_MS)
  })
}

function unavailable(): never {
  throw new Error('Il collegamento a Supabase non è ancora disponibile')
}

export const queryKeys = {
  collaborators: ['collaborators'] as const,
  companies: (assigneeId?: string) => ['companies', assigneeId ?? 'all'] as const,
  dashboard: (userId: string, role: DashboardViewer['role']) => ['dashboard', userId, role] as const,
  callQueue: (userId: string) => ['call-queue', userId] as const,
  callLogs: (companyId: string) => ['call-logs', companyId] as const,
  bookings: ['explanation-bookings'] as const,
}

export async function getCompanies(filter?: CompanyFilter): Promise<Company[]> {
  if (!isDemoMode) return unavailable()
  await wait()
  return listCompanies(filter?.assigneeId)
}

export async function createCompany(input: CompanyDraft, actor: Actor): Promise<Company> {
  if (!isDemoMode) return unavailable()
  await wait()
  return createCompanyRecord(input, actor)
}

export async function updateCompany(id: string, details: CompanyDetails, actor: Actor): Promise<Company> {
  if (!isDemoMode) return unavailable()
  await wait()
  return updateCompanyDetailsRecord(id, details, actor)
}

export async function setCompanyStatus(id: string, status: CompanyStatus, actor: Actor): Promise<Company> {
  if (!isDemoMode) return unavailable()
  await wait()
  return setCompanyStatusRecord(id, status, actor)
}

export async function assignCompany(id: string, assigneeId: string | null, actor: Actor): Promise<Company> {
  if (!isDemoMode) return unavailable()
  await wait()
  return assignCompanyRecord(id, assigneeId, actor)
}

export async function addCompanyNote(id: string, body: string, actor: Actor): Promise<CompanyNote> {
  if (!isDemoMode) return unavailable()
  await wait()
  return addCompanyNoteRecord(id, body, actor)
}

export async function deleteCompanies(ids: string[], actor: Actor): Promise<void> {
  if (!isDemoMode) return unavailable()
  await wait()
  deleteCompanyRecords(ids, actor)
}

export async function bulkAssignCompanies(ids: string[], assigneeId: string | null, actor: Actor): Promise<void> {
  if (!isDemoMode) return unavailable()
  await wait()
  bulkAssignCompanyRecords(ids, assigneeId, actor)
}

export async function bulkSetCompanyStatus(ids: string[], status: CompanyStatus, actor: Actor): Promise<void> {
  if (!isDemoMode) return unavailable()
  await wait()
  bulkSetCompanyStatusRecords(ids, status, actor)
}

export async function importCompanies(
  rows: ImportCompanyRow[],
  policy: DuplicatePolicy,
  actor: Actor,
): Promise<ImportResult> {
  if (!isDemoMode) return unavailable()
  await wait()
  return importCompanyRecords(rows, policy, actor)
}

export async function getCallQueue(actor: Actor): Promise<CallQueue> {
  if (!isDemoMode) return unavailable()
  await wait()
  return callQueueRecord(actor)
}

export async function getCallLogs(companyId: string, actor: Actor): Promise<CallLog[]> {
  if (!isDemoMode) return unavailable()
  await wait()
  return callLogsRecord(companyId, actor)
}

export async function recordCallOutcome(input: CallOutcomeInput, actor: Actor): Promise<{ company: Company; log: CallLog }> {
  if (!isDemoMode) return unavailable()
  await wait()
  return recordCallOutcomeRecord(input, actor)
}

export async function undoCall(logId: string, actor: Actor): Promise<Company> {
  if (!isDemoMode) return unavailable()
  await wait()
  return undoCallRecord(logId, actor)
}

export async function claimCompany(id: string, actor: Actor): Promise<Company> {
  if (!isDemoMode) return unavailable()
  await wait()
  return claimCompanyRecord(id, actor)
}

export async function releaseCompany(id: string, actor: Actor): Promise<Company> {
  if (!isDemoMode) return unavailable()
  await wait()
  return releaseCompanyRecord(id, actor)
}

export async function getExplanationBookings(): Promise<ExplanationBooking[]> {
  if (!isDemoMode) return unavailable()
  await wait()
  return listExplanationBookingsRecord()
}

export async function bookExplanation(input: BookExplanationInput, actor: Actor): Promise<ExplanationBooking> {
  if (!isDemoMode) return unavailable()
  await wait()
  return bookExplanationRecord(input, actor)
}

export async function cancelExplanation(id: string, actor: Actor): Promise<void> {
  if (!isDemoMode) return unavailable()
  await wait()
  cancelExplanationRecord(id, actor)
}

export async function getCollaborators(): Promise<Collaborator[]> {
  if (!isDemoMode) return unavailable()
  await wait()
  return listCollaborators()
}

export async function createCollaborator(input: CollaboratorDraft): Promise<Collaborator> {
  if (!isDemoMode) return unavailable()
  await wait()
  return createCollaboratorRecord(input)
}

export async function updateCollaborator(
  userId: string,
  input: CollaboratorDraft,
  actorId: string,
): Promise<Collaborator> {
  if (!isDemoMode) return unavailable()
  await wait()
  return updateCollaboratorRecord(userId, input, actorId)
}

export async function setCollaboratorActive(userId: string, active: boolean, actorId: string): Promise<void> {
  if (!isDemoMode) return unavailable()
  await wait()
  setCollaboratorActiveRecord(userId, active, actorId)
}

function startOfToday(): number {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function startOfWeek(): number {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  const day = date.getDay()
  const distance = day === 0 ? 6 : day - 1
  date.setDate(date.getDate() - distance)
  return date.getTime()
}

export async function getDashboardStats(viewer: DashboardViewer): Promise<DashboardStats> {
  if (!isDemoMode) return unavailable()
  await wait()
  const companies = listCompanies(viewer.role === 'collaboratore' ? viewer.id : undefined)
  const logs = listCallLogs().filter((log) => (viewer.role === 'admin' ? true : log.user_id === viewer.id))
  const today = startOfToday()
  const week = startOfWeek()
  const ranking: CallRankingRow[] =
    viewer.role === 'admin'
      ? listCollaborators()
          .filter((person) => person.role === 'collaboratore')
          .map((person) => ({ user_id: person.id, full_name: person.full_name, accepted: person.calls_accepted }))
          .sort((left, right) => right.accepted - left.accepted || left.full_name.localeCompare(right.full_name, 'it'))
      : []
  return {
    total: companies.length,
    assigned: companies.filter((company) => company.assignee_id !== null).length,
    byStatus: COMPANY_STATUSES.map((status) => ({
      status,
      count: companies.filter((company) => company.status === status).length,
    })),
    callsToday: logs.filter((log) => new Date(log.created_at).getTime() >= today).length,
    callsThisWeek: logs.filter((log) => new Date(log.created_at).getTime() >= week).length,
    ranking,
  }
}
