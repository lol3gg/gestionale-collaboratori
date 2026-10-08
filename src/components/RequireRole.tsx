import { Navigate, Outlet } from 'react-router-dom'
import { useProfile } from '../hooks/useProfile'
import { AUTH_BYPASS } from '../lib/authBypass'
import type { UserRole } from '../types'
import { FullPageSpinner } from './ui/Spinner'

export function RequireRole({ role }: { role: UserRole }) {
  const { profile, loading } = useProfile()
  if (AUTH_BYPASS) return <Outlet />
  if (loading) return <FullPageSpinner />
  if (!profile || profile.role !== role) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
