import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/ui/Toast'
import {
  createSavedSearch,
  deleteSavedSearch,
  getSavedSearches,
  getSearchGeoOptions,
  queryKeys,
  updateSavedSearch,
} from '../lib/api'
import { errorMessage } from '../lib/validators'
import type { Actor, SavedSearchDraft } from '../types'

export function useSavedSearches(enabled = true) {
  return useQuery({
    queryKey: queryKeys.searches,
    queryFn: getSavedSearches,
    enabled,
  })
}

export function useSearchGeoOptions(params?: { region?: string; province?: string }, enabled = true) {
  return useQuery({
    queryKey: queryKeys.searchGeo(params),
    queryFn: () => getSearchGeoOptions(params),
    enabled,
  })
}

export function useCreateSavedSearch() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({ draft, actor }: { draft: SavedSearchDraft; actor: Actor }) => createSavedSearch(draft, actor),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.searches })
      toast.success('Ricerca salvata')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useUpdateSavedSearch() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: SavedSearchDraft }) => updateSavedSearch(id, draft),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.searches })
      toast.success('Ricerca aggiornata')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useDeleteSavedSearch() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (id: string) => deleteSavedSearch(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.searches })
      toast.success('Ricerca eliminata')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}
