import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/ui/Toast'
import {
  addExplanationExtraSlot,
  bookExplanation,
  cancelExplanation,
  getExplanationBookings,
  getExplanationExtraSlots,
  queryKeys,
  removeExplanationExtraSlot,
} from '../lib/api'
import { errorMessage } from '../lib/validators'
import type { Actor, AddExplanationExtraSlotInput, BookExplanationInput, Profile } from '../types'

function toActor(profile: Profile): Actor {
  return { id: profile.id, full_name: profile.full_name, role: profile.role }
}

function useRefreshCalendar() {
  const queryClient = useQueryClient()
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings }),
      queryClient.invalidateQueries({ queryKey: queryKeys.extraSlots }),
    ])
  }
}

export function useExplanationBookings(profile: Profile | null) {
  return useQuery({
    queryKey: queryKeys.bookings,
    queryFn: () => getExplanationBookings(),
    enabled: profile !== null,
  })
}

export function useExplanationExtraSlots(profile: Profile | null) {
  return useQuery({
    queryKey: queryKeys.extraSlots,
    queryFn: () => getExplanationExtraSlots(),
    enabled: profile !== null,
  })
}

export function useBookExplanation(profile: Profile | null) {
  const refresh = useRefreshCalendar()
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
  const refresh = useRefreshCalendar()
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

export function useAddExplanationExtraSlot(profile: Profile | null) {
  const refresh = useRefreshCalendar()
  const toast = useToast()
  return useMutation({
    mutationFn: (input: AddExplanationExtraSlotInput) => {
      if (!profile) throw new Error('Sessione non disponibile')
      return addExplanationExtraSlot(input, toActor(profile))
    },
    onSuccess: async () => {
      await refresh()
      toast.success('Orario aggiunto')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useRemoveExplanationExtraSlot(profile: Profile | null) {
  const refresh = useRefreshCalendar()
  const toast = useToast()
  return useMutation({
    mutationFn: (id: string) => {
      if (!profile) throw new Error('Sessione non disponibile')
      return removeExplanationExtraSlot(id, toActor(profile))
    },
    onSuccess: async () => {
      await refresh()
      toast.success('Orario rimosso')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}
