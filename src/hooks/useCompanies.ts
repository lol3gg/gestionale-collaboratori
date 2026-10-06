import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/ui/Toast'
import {
  addCompanyNote,
  assignCompany,
  bulkAssignCompanies,
  bulkSetCompanyStatus,
  createCompany,
  deleteCompanies,
  getCompanies,
  importCompanies,
  queryKeys,
  setCompanyStatus,
  updateCompany,
} from '../lib/api'
import { errorMessage } from '../lib/validators'
import type {
  Actor,
  CompanyDetails,
  CompanyDraft,
  CompanyStatus,
  DuplicatePolicy,
  ImportCompanyRow,
  Profile,
} from '../types'

function toActor(profile: Profile): Actor {
  return { id: profile.id, full_name: profile.full_name, role: profile.role }
}

export function useCompanies(profile: Profile | null) {
  const assigneeId = profile?.role === 'collaboratore' ? profile.id : undefined
  return useQuery({
    queryKey: queryKeys.companies(assigneeId),
    queryFn: () => getCompanies(assigneeId ? { assigneeId } : undefined),
    enabled: profile !== null,
  })
}

function useRefreshCompanies() {
  const queryClient = useQueryClient()
  return async () => {
    await queryClient.invalidateQueries({ queryKey: ['companies'] })
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    await queryClient.invalidateQueries({ queryKey: ['call-queue'] })
    await queryClient.invalidateQueries({ queryKey: ['call-logs'] })
    await queryClient.invalidateQueries({ queryKey: queryKeys.collaborators })
  }
}

export function useCreateCompany(profile: Profile | null) {
  const refresh = useRefreshCompanies()
  const toast = useToast()
  return useMutation({
    mutationFn: (input: CompanyDraft) => {
      if (!profile) throw new Error('Sessione non disponibile')
      return createCompany(input, toActor(profile))
    },
    onSuccess: async () => {
      await refresh()
      toast.success('Azienda creata')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useUpdateCompany(profile: Profile | null) {
  const refresh = useRefreshCompanies()
  const toast = useToast()
  return useMutation({
    mutationFn: (input: { id: string; details: CompanyDetails }) => {
      if (!profile) throw new Error('Sessione non disponibile')
      return updateCompany(input.id, input.details, toActor(profile))
    },
    onSuccess: async () => {
      await refresh()
      toast.success('Azienda aggiornata')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useSetCompanyStatus(profile: Profile | null) {
  const refresh = useRefreshCompanies()
  const toast = useToast()
  return useMutation({
    mutationFn: (input: { id: string; status: CompanyStatus }) => {
      if (!profile) throw new Error('Sessione non disponibile')
      return setCompanyStatus(input.id, input.status, toActor(profile))
    },
    onSuccess: async () => {
      await refresh()
      toast.success('Stato aggiornato')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useAssignCompany(profile: Profile | null) {
  const refresh = useRefreshCompanies()
  const toast = useToast()
  return useMutation({
    mutationFn: (input: { id: string; assigneeId: string | null }) => {
      if (!profile) throw new Error('Sessione non disponibile')
      return assignCompany(input.id, input.assigneeId, toActor(profile))
    },
    onSuccess: async () => {
      await refresh()
      toast.success('Assegnazione aggiornata')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useAddCompanyNote(profile: Profile | null) {
  const refresh = useRefreshCompanies()
  const toast = useToast()
  return useMutation({
    mutationFn: (input: { id: string; body: string }) => {
      if (!profile) throw new Error('Sessione non disponibile')
      return addCompanyNote(input.id, input.body, toActor(profile))
    },
    onSuccess: async () => {
      await refresh()
      toast.success('Nota aggiunta')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useDeleteCompanies(profile: Profile | null) {
  const refresh = useRefreshCompanies()
  const toast = useToast()
  return useMutation({
    mutationFn: (ids: string[]) => {
      if (!profile) throw new Error('Sessione non disponibile')
      return deleteCompanies(ids, toActor(profile))
    },
    onSuccess: async (_data, ids) => {
      await refresh()
      toast.success(ids.length === 1 ? 'Azienda eliminata' : `${ids.length} aziende eliminate`)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useBulkAssignCompanies(profile: Profile | null) {
  const refresh = useRefreshCompanies()
  const toast = useToast()
  return useMutation({
    mutationFn: (input: { ids: string[]; assigneeId: string | null }) => {
      if (!profile) throw new Error('Sessione non disponibile')
      return bulkAssignCompanies(input.ids, input.assigneeId, toActor(profile))
    },
    onSuccess: async (_data, input) => {
      await refresh()
      toast.success(
        input.ids.length === 1 ? 'Azienda assegnata' : `${input.ids.length} aziende assegnate`,
      )
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useBulkSetCompanyStatus(profile: Profile | null) {
  const refresh = useRefreshCompanies()
  const toast = useToast()
  return useMutation({
    mutationFn: (input: { ids: string[]; status: CompanyStatus }) => {
      if (!profile) throw new Error('Sessione non disponibile')
      return bulkSetCompanyStatus(input.ids, input.status, toActor(profile))
    },
    onSuccess: async () => {
      await refresh()
      toast.success('Stato aggiornato')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useImportCompanies(profile: Profile | null) {
  const refresh = useRefreshCompanies()
  const toast = useToast()
  return useMutation({
    mutationFn: (input: { rows: ImportCompanyRow[]; policy: DuplicatePolicy }) => {
      if (!profile) throw new Error('Sessione non disponibile')
      return importCompanies(input.rows, input.policy, toActor(profile))
    },
    onSuccess: async (result) => {
      await refresh()
      toast.success(
        `Importate ${result.imported}, aggiornate ${result.updated}, saltate ${result.skipped}, errori ${result.errors.length}`,
      )
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}
