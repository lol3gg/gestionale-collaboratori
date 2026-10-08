export const COMPANY_STATUSES = [
  'da_chiamare',
  'non_risponde',
  'da_richiamare',
  'accettato',
  'rifiutato',
  'numero_errato',
] as const

export type CompanyStatus = (typeof COMPANY_STATUSES)[number]

export type UserRole = 'admin' | 'collaboratore'

export type Profile = {
  id: string
  full_name: string
  email: string
  role: UserRole
  active: boolean
  daily_goal: number
  created_at: string
}

export type Collaborator = Profile & {
  assigned_companies: number
  calls_total: number
  calls_accepted: number
  calls_rejected: number
  acceptance_rate: number | null
}

export type CreateCollaboratorInput = {
  full_name: string
  email: string
  password: string
  role: UserRole
}

export type UpdateCollaboratorInput = {
  user_id: string
  full_name: string
  role: UserRole
  daily_goal?: number
}

export type SetActiveInput = {
  user_id: string
  active: boolean
}

export type ResetPasswordInput = {
  user_id: string
  password: string
}

export type CollaboratorDraft = {
  full_name: string
  email: string
  role: UserRole
  password?: string
  daily_goal?: number
}

export type Actor = {
  id: string
  full_name: string
  role: UserRole
}

export type CompanyNote = {
  id: string
  author_id: string
  author_name: string
  body: string
  created_at: string
}

export type CompanyDetails = {
  name: string
  phone: string
  email: string | null
  website: string
  address: string | null
  city: string
  province: string
  region: string
  employees: number | null
}

export type CompanyDraft = CompanyDetails & {
  status: CompanyStatus
  assignee_id: string | null
  callback_at?: string | null
}

export type Company = CompanyDetails & {
  id: string
  status: CompanyStatus
  assignee_id: string | null
  callback_at: string | null
  created_at: string
  notes: CompanyNote[]
}

export type CallLog = {
  id: string
  company_id: string
  user_id: string
  outcome: CompanyStatus
  note: string | null
  callback_at: string | null
  created_at: string
}

export type CallOutcomeInput = {
  companyId: string
  outcome: CompanyStatus
  note: string | null
  callbackAt: string | null
}

export type CallQueue = {
  companies: Company[]
  logs: CallLog[]
  total: number
  counts: {
    da_chiamare: number
    da_riprovare: number
    da_richiamare: number
    mie: number
    chiusi: number
  }
  regions: string[]
  provinces: string[]
  cities: string[]
}

export type ExplanationBooking = {
  id: string
  company_id: string
  user_id: string
  starts_at: string
  ends_at: string
  created_at: string
}

export type ExplanationExtraSlot = {
  id: string
  date_key: string
  start_min: number
  created_at: string
}

export type BookExplanationInput = {
  companyId: string
  startsAt: string
}

export type AddExplanationExtraSlotInput = {
  dateKey: string
  startMin: number
}

export type CompanyFilter = {
  assigneeId?: string
}

export type SavedSearch = {
  id: string
  user_id: string
  name: string
  query: string
  region: string | null
  province: string | null
  city: string | null
  status: CompanyStatus | null
  created_at: string
}

export type SavedSearchDraft = {
  name: string
  query: string
  region: string | null
  province: string | null
  city: string | null
  status: CompanyStatus | null
}

export type SearchGeoOptions = {
  regions: string[]
  provinces: string[]
  cities: string[]
}

export type CompanyListParams = {
  search?: string
  status?: CompanyStatus | 'all'
  region?: string
  province?: string
  city?: string
  assignee?: string
  phone?: 'all' | 'yes' | 'no'
  sortKey?:
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
  sortDir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  assigneeId?: string
}

export type CompanyListResult = {
  companies: Company[]
  total: number
}

export type DashboardViewer = {
  id: string
  role: UserRole
}

export type CallRankingRow = {
  user_id: string
  full_name: string
  accepted: number
}

export type DashboardCallbackItem = {
  id: string
  name: string
  callback_at: string
  phone?: string
}

export type DashboardStats = {
  total: number
  assigned: number
  byStatus: { status: CompanyStatus; count: number }[]
  callsToday: number
  callsThisWeek: number
  acceptedToday: number
  rejectedToday: number
  acceptanceRate30d: number | null
  dailyGoal: number
  claimedCount: number
  claimLimit: number
  ranking: CallRankingRow[]
  callbacksOverdue: DashboardCallbackItem[]
  callbacksToday: DashboardCallbackItem[]
  callbacksDueCount: number
}

export type DuplicatePolicy = 'skip' | 'update'

export type ImportCompanyRow = {
  line: number
  name: string
  phone: string
  email: string | null
  website: string
  city: string
  province: string
  region: string
  employees: number | null
}

export type ImportIssue = {
  line: number
  message: string
}

export type ImportResult = {
  imported: number
  updated: number
  skipped: number
  errors: ImportIssue[]
}

export type AdminUsersRequest =
  | ({ action: 'create' } & CreateCollaboratorInput)
  | ({ action: 'update' } & UpdateCollaboratorInput)
  | ({ action: 'set_active' } & SetActiveInput)
  | ({ action: 'reset_password' } & ResetPasswordInput)
