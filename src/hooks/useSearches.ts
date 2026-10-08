import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/ui/Toast'
import {
  addSearchResultsToCompanies,
  cancelImportBatch,
  discardSearchResults,
  deletePlacesSearch,
  estimatePlacesSearch,
  getPlacesSearches,
  getSearchCoverage,
  getSearchGeoOptions,
  getSearchJob,
  getSearchResults,
  queryKeys,
} from '../lib/api'
import {
  invokeSearchCompaniesPause,
  invokeSearchCompaniesProcess,
  invokeSearchCompaniesResume,
  invokeSearchCompaniesStart,
} from '../lib/searchCompanies'
import { errorMessage } from '../lib/validators'
import type { PlacesSearchDraft } from '../types'

export function usePlacesSearches(enabled = true) {
  return useQuery({
    queryKey: queryKeys.searches,
    queryFn: getPlacesSearches,
    enabled,
    refetchInterval: (query) => {
      const rows = query.state.data
      if (!rows) return false
      const active = rows.some((s) => s.status === 'queued' || s.status === 'running')
      return active ? 3000 : false
    },
  })
}

export function useSearchJob(searchId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.searchJob(searchId ?? ''),
    queryFn: () => getSearchJob(searchId!),
    enabled: Boolean(searchId) && enabled,
    refetchInterval: (query) => {
      const job = query.state.data
      if (!job) return false
      if (job.status === 'queued' || job.status === 'running') return 2500
      return false
    },
  })
}

export function useSearchCoverage(searchId: string | null, enabled = true, poll = false) {
  return useQuery({
    queryKey: queryKeys.searchCoverage(searchId ?? ''),
    queryFn: () => getSearchCoverage(searchId!),
    enabled: Boolean(searchId) && enabled,
    refetchInterval: poll ? 4000 : false,
  })
}

export function useSearchResults(searchId: string | null, enabled = true, poll = false) {
  return useQuery({
    queryKey: queryKeys.searchResults(searchId ?? ''),
    queryFn: () => getSearchResults(searchId!),
    enabled: Boolean(searchId) && enabled,
    refetchInterval: poll ? 4000 : false,
  })
}

export function useSearchGeoOptions(params?: { country?: string; region?: string }, enabled = true) {
  return useQuery({
    queryKey: queryKeys.searchGeo(params),
    queryFn: () => getSearchGeoOptions(params),
    enabled,
    placeholderData: (previous) => previous,
  })
}

export function useEstimatePlacesSearch() {
  return useMutation({
    mutationFn: estimatePlacesSearch,
  })
}

export function useStartPlacesSearch() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (draft: PlacesSearchDraft) => invokeSearchCompaniesStart(draft),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.searches })
      if (result.search_id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.searchJob(result.search_id) })
        await queryClient.invalidateQueries({ queryKey: queryKeys.searchResults(result.search_id) })
      }
      if (result.error && result.done) {
        toast.error(result.error)
      } else if (result.done) {
        toast.success('Ricerca completata')
      } else {
        toast.success('Ricerca avviata')
      }
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useProcessPlacesSearch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (searchId: string) => invokeSearchCompaniesProcess(searchId),
    onSuccess: async (_result, searchId) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.searches })
      await queryClient.invalidateQueries({ queryKey: queryKeys.searchJob(searchId) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.searchResults(searchId) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.searchCoverage(searchId) })
    },
  })
}

export function usePausePlacesSearch() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (searchId: string) => invokeSearchCompaniesPause(searchId),
    onSuccess: async (_result, searchId) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.searches })
      await queryClient.invalidateQueries({ queryKey: queryKeys.searchJob(searchId) })
      toast.success('Ricerca in pausa')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useResumePlacesSearch() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (searchId: string) => invokeSearchCompaniesResume(searchId),
    onSuccess: async (result, searchId) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.searches })
      await queryClient.invalidateQueries({ queryKey: queryKeys.searchJob(searchId) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.searchResults(searchId) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.searchCoverage(searchId) })
      if (result.paused) toast.error(result.error ?? 'In pausa per limite')
      else toast.success('Ricerca ripresa')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useDeletePlacesSearch() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (id: string) => deletePlacesSearch(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.searches })
      toast.success('Ricerca eliminata')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useAddSearchResults() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (ids: string[]) => addSearchResultsToCompanies(ids),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['search-results'] })
      await queryClient.invalidateQueries({ queryKey: queryKeys.searches })
      await queryClient.invalidateQueries({ queryKey: ['companies'] })
      const parts = [`${result.inserted} aggiunte`]
      if (result.duplicates) parts.push(`${result.duplicates} doppioni scartati`)
      if (result.doubtful) parts.push(`${result.doubtful} dubbi`)
      if (result.skipped) parts.push(`${result.skipped} saltate`)
      toast.success(parts.join(' · '))
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useCancelImportBatch() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (batchId: string) => cancelImportBatch(batchId),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.searches })
      await queryClient.invalidateQueries({ queryKey: ['companies'] })
      const msg = `${result.deleted} eliminate`
      const kept =
        result.kept > 0
          ? ` · ${result.kept} mantenute (assegnate: ${result.kept_assigned}, con chiamate: ${result.kept_called})`
          : ''
      toast.success(msg + kept)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useDiscardSearchResults() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({ ids, discarded }: { ids: string[]; discarded?: boolean }) =>
      discardSearchResults(ids, discarded ?? true),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['search-results'] })
      toast.success('Risultati aggiornati')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}
