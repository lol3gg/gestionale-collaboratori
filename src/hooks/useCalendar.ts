import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/ui/Toast'
import { bookExplanation, cancelExplanation, getExplanationBookings, queryKeys } from '../lib/api'
import { errorMessage } from '../lib/validators'
import type { Actor, BookExplanationInput, Profile } from '../types'

function toActor(profile: Profile): Actor {
  return { id: profile.id, full_name: profile.full_name, role: profile.role }
}

function useRefreshBookings() {
  const queryClient = useQueryClient()
  return async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.bookings })
  }
}

export function useExplanationBookings(profile: Profile | null) {
  return useQuery({
    queryKey: queryKeys.bookings,
    queryFn: () => getExplanationBookings(),
    enabled: profile !== null,
  })
}

export function useBookExplanation(profile: Profile | null) {
  const refresh = useRefreshBookings()
  const toast = useToast()
  return useMutation({
    mutationFn: (input: BookExplanationInput) => {
      if (!profile) throw new Error('Sessione non disponibile')
      return bookExplanation(input, toActor(profile))
    },
    onSuccess: async () => {
      await refresh()
      toast.success('Call di spiegazione fissata')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useCancelExplanation(profile: Profile | null) {
  const refresh = useRefreshBookings()
  const toast = useToast()
  return useMutation({
    mutationFn: (id: string) => {
      if (!profile) throw new Error('Sessione non disponibile')
      return cancelExplanation(id, toActor(profile))
    },
    onSuccess: async () => {
      await refresh()
      toast.success('Prenotazione annullata')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}
