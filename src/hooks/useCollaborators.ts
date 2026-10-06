import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import {
  createCollaborator,
  getCollaborators,
  queryKeys,
  setCollaboratorActive,
  updateCollaborator,
} from '../lib/api'
import { errorMessage } from '../lib/validators'
import type { CollaboratorDraft } from '../types'
import { useToast } from '../components/ui/Toast'

export function useCollaborators() {
  return useQuery({
    queryKey: queryKeys.collaborators,
    queryFn: getCollaborators,
  })
}

function useRefreshCollaboratorData() {
  const queryClient = useQueryClient()
  const { refreshProfile } = useAuth()
  return async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.collaborators })
    await queryClient.invalidateQueries({ queryKey: ['companies'] })
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    await queryClient.invalidateQueries({ queryKey: ['call-queue'] })
    refreshProfile()
  }
}

export function useCreateCollaborator() {
  const refresh = useRefreshCollaboratorData()
  const toast = useToast()
  return useMutation({
    mutationFn: (input: CollaboratorDraft) => createCollaborator(input),
    onSuccess: async () => {
      await refresh()
      toast.success('Collaboratore creato')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useUpdateCollaborator() {
  const refresh = useRefreshCollaboratorData()
  const toast = useToast()
  return useMutation({
    mutationFn: (input: CollaboratorDraft & { user_id: string; actor_id: string }) =>
      updateCollaborator(input.user_id, input, input.actor_id),
    onSuccess: async () => {
      await refresh()
      toast.success('Collaboratore aggiornato')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useSetCollaboratorActive() {
  const refresh = useRefreshCollaboratorData()
  const toast = useToast()
  return useMutation({
    mutationFn: (input: { user_id: string; active: boolean; actor_id: string }) =>
      setCollaboratorActive(input.user_id, input.active, input.actor_id),
    onSuccess: async (_data, input) => {
      await refresh()
      toast.success(input.active ? 'Account riattivato' : 'Collaboratore disattivato')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}
