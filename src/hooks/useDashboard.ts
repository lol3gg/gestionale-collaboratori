import { useQuery } from '@tanstack/react-query'
import { getDashboardStats, queryKeys } from '../lib/api'
import type { Profile } from '../types'

export function useDashboardStats(profile: Profile | null) {
  return useQuery({
    queryKey: queryKeys.dashboard(profile?.id ?? 'anon', profile?.role ?? 'collaboratore'),
    queryFn: () => {
      if (!profile) throw new Error('Profilo non disponibile')
      return getDashboardStats({ id: profile.id, role: profile.role })
    },
    enabled: profile !== null,
  })
}
