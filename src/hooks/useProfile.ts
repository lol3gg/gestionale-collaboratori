import { useAuth } from '../auth/AuthProvider'

export function useProfile() {
  const { profile, loading } = useAuth()
  return { profile, loading, error: null as string | null }
}
