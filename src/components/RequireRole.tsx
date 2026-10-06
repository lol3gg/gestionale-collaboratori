import { Navigate, Outlet } from 'react-router-dom'
import { useProfile } from '../hooks/useProfile'
import type { UserRole } from '../types'
import { FullPageSpinner } from './ui/Spinner'

export function RequireRole({ role }: { role: UserRole }) {
  const { profile, loading } = useProfile()
  if (loading) return <FullPageSpinner />
  if (!profile || profile.role !== role) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
