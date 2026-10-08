import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/ui/Toast'
import {
  claimCompany,
  getCallLogs,
  getCallQueue,
  queryKeys,
  recordCallOutcome,
  releaseCompany,
  undoCall,
  type CallQueueParams,
} from '../lib/api'
import { errorMessage } from '../lib/validators'
import type { Actor, CallOutcomeInput, Profile } from '../types'

function toActor(profile: Profile): Actor {
  return { id: profile.id, full_name: profile.full_name, role: profile.role }
}

function useRefreshCalls() {
  const queryClient = useQueryClient()
  return async () => {
    await queryClient.invalidateQueries({ queryKey: ['companies'] })
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    await queryClient.invalidateQueries({ queryKey: ['call-queue'] })
    await queryClient.invalidateQueries({ queryKey: ['call-logs'] })
    await queryClient.invalidateQueries({ queryKey: queryKeys.collaborators })
    await queryClient.invalidateQueries({ queryKey: queryKeys.bookings })
  }
}

function isConflict(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase()
  return message.includes('già assegnata') || message.includes('gia assegnata')
}

export function useCallQueue(profile: Profile | null, params?: CallQueueParams) {
  return useQuery({
    queryKey: queryKeys.callQueue(profile?.id ?? 'none', params),
    queryFn: () => {
      if (!profile) throw new Error('Sessione non disponibile')
      return getCallQueue(toActor(profile), params)
    },
    enabled: profile !== null && Boolean(params),
  })
}

export function useCompanyCalls(companyId: string | null, profile: Profile | null) {
  return useQuery({
    queryKey: queryKeys.callLogs(companyId ?? 'none'),
    queryFn: () => {
      if (!profile || !companyId) throw new Error('Sessione non disponibile')
      return getCallLogs(companyId, toActor(profile))
    },
    enabled: profile !== null && companyId !== null,
  })
}

export function useRecordCall(profile: Profile | null) {
  const refresh = useRefreshCalls()
  const toast = useToast()
  return useMutation({
    mutationFn: (input: CallOutcomeInput) => {
      if (!profile) throw new Error('Sessione non disponibile')
      return recordCallOutcome(input, toActor(profile))
    },
    onSuccess: async () => {
      await refresh()
    },
    onError: async (error) => {
      toast.error(errorMessage(error))
      if (isConflict(error)) await refresh()
    },
  })
}

export function useUndoCall(profile: Profile | null) {
  const refresh = useRefreshCalls()
  const toast = useToast()
  return useMutation({
    mutationFn: (logId: string) => {
      if (!profile) throw new Error('Sessione non disponibile')
      return undoCall(logId, toActor(profile))
    },
    onSuccess: async () => {
      await refresh()
      toast.success('Esito annullato')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useClaimCompany(profile: Profile | null) {
  const refresh = useRefreshCalls()
  const toast = useToast()
  return useMutation({
    mutationFn: (id: string) => {
      if (!profile) throw new Error('Sessione non disponibile')
      return claimCompany(id, toActor(profile))
    },
    onSuccess: async () => {
      await refresh()
      toast.success('Azienda presa in carico')
    },
    onError: async (error) => {
      toast.error(errorMessage(error))
      if (isConflict(error)) await refresh()
    },
  })
}

export function useReleaseCompany(profile: Profile | null) {
  const refresh = useRefreshCalls()
  const toast = useToast()
  return useMutation({
    mutationFn: (id: string) => {
      if (!profile) throw new Error('Sessione non disponibile')
      return releaseCompany(id, toActor(profile))
    },
    onSuccess: async () => {
      await refresh()
      toast.success('Azienda rimessa nel pool')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}
