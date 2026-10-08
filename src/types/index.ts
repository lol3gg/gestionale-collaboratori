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

export const SEARCH_STATUSES = [
  'draft',
  'queued',
  'running',
  'completed',
  'partial_error',
  'failed',
  'cancelled',
  'paused',
  'paused_limit',
] as const

export type SearchStatus = (typeof SEARCH_STATUSES)[number]

export type SearchCoverage = {
  comuni_total: number
  comuni_done: number
  cells_total: number
  cells_done: number
  cells_pending: number
  cells_saturo: number
  cells_manual_review: number
  cells_error: number
  uncovered_comuni: Array<{
    comune_id: string
    name: string
    province: string
    population: number | null
    pending_cells: number
  }>
}

export type BatchSummary = {
  comuni_done: number
  comuni_total: number
  found: number
  inserted: number
  duplicates_safe: number
  duplicates_doubtful: number
  without_phone: number
  requests: number
  estimated_cost_eur: number
}

export type PlacesSearch = {
  id: string
  user_id: string
  name: string
  country: string
  region: string | null
  regions: string[]
  provinces: string[]
  keywords: string[]
  max_requests: number
  estimated_queries: number
  estimated_cost_eur: number
  actual_requests: number
  results_count: number
  added_count: number
  auto_add_to_companies: boolean
  import_batch_id: string | null
  summary: BatchSummary | null
  status: SearchStatus
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export type PlacesSearchDraft = {
  country: string
  regions: string[]
  provinces?: string[]
  keywords: string[]
  max_requests: number
  estimated_queries: number
  estimated_cost_eur: number
  auto_add: boolean
  name?: string
}

export type ImportBatch = {
  id: string
  search_id: string | null
  country: string
  regions: string[]
  keywords: string[]
  auto_add: boolean
  status: 'active' | 'completed' | 'cancelled' | 'partial_cancel'
  comuni_total: number
  comuni_done: number
  found_count: number
  inserted_count: number
  duplicates_safe: number
  duplicates_doubtful: number
  without_phone: number
  requests_count: number
  estimated_cost_eur: number
  cancel_deleted: number
  cancel_kept: number
  created_at: string
  completed_at: string | null
}

export type CancelBatchResult = {
  deleted: number
  kept: number
  kept_assigned: number
  kept_called: number
}

export type PlacesEstimate = {
  comuni: number
  keywords: number
  queries: number
  estimated_cost_eur: number
  cost_per_request_eur: number
  comuni_preview: Array<{ name: string; province: string; population: number | null }>
}

export type SearchJob = {
  id: string
  search_id: string
  status: SearchStatus
  total_queries: number
  completed_queries: number
  cursor_offset: number
  batch_size: number
  request_count: number
  saturated_cells: number
  pending_cells: number
  comuni_total: number
  comuni_done: number
  pause_summary: string | null
  error_message: string | null
  updated_at: string
}

export type SearchResultRow = {
  id: string
  search_id: string
  google_place_id: string | null
  name: string
  phone: string
  phone_normalized: string
  website: string
  address: string | null
  city: string
  province: string
  region: string
  country: string
  business_status: string | null
  is_duplicate_in_db: boolean
  is_duplicate_in_search: boolean
  possible_duplicate: boolean
  similar_company_id: string | null
  discarded: boolean
  added_company_id: string | null
  auto_added: boolean
  fetched_at: string
  created_at: string
}

export type AddSearchResultsResult = {
  inserted: number
  duplicates: number
  doubtful: number
  skipped: number
  without_phone: number
}

export type SearchProcessResponse = {
  ok?: boolean
  search_id?: string
  job_status?: string
  completed_queries?: number
  total_queries?: number
  request_count?: number
  results_count?: number
  comuni_done?: number
  comuni_total?: number
  cells_pending?: number
  cells_saturo?: number
  done?: boolean
  paused?: boolean
  error?: string
  summary?: BatchSummary
}

/** @deprecated filtri salvati — sostituito da PlacesSearch */
export type SavedSearch = PlacesSearch
export type SavedSearchDraft = PlacesSearchDraft

export type SearchGeoOptions = {
  regions: string[]
  provinces: string[]
  countries: string[]
}

export const KEYWORD_PRESETS = [
  'impresa edile',
  'ditta edile',
  'costruzioni',
  'ristrutturazioni',
  'carpenteria',
] as const

export const SEARCH_COUNTRIES = [
  { code: 'IT', label: 'Italia' },
  { code: 'CH', label: 'Svizzera' },
  { code: 'FR', label: 'Francia' },
  { code: 'DE', label: 'Germania' },
  { code: 'AT', label: 'Austria' },
  { code: 'ES', label: 'Spagna' },
] as const

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
