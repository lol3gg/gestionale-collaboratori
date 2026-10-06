import { useAuth } from '../auth/AuthProvider'

export function useProfile() {
  const { profile, loading, profileError } = useAuth()
  return { profile, loading, error: profileError }
}
