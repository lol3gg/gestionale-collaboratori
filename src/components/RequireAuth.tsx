import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../hooks/useProfile'
import { AUTH_BYPASS } from '../lib/authBypass'
import { Button } from './ui/Button'
import { FullPageSpinner } from './ui/Spinner'

export function RequireAuth() {
  const { profile, loading, error } = useProfile()
  const { logout } = useAuth()

  if (loading) return <FullPageSpinner />

  if (AUTH_BYPASS) {
    if (!profile) return <Navigate to="/login" replace />
    return <Outlet />
  }

  if (!profile && error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="card-surface w-full max-w-md p-6 text-center">
          <h1 className="text-lg font-semibold tracking-tight text-ink">Profilo non disponibile</h1>
          <p className="mt-2 text-[15px] text-muted">{error}</p>
          <div className="mt-5">
            <Button variant="secondary" onClick={() => void logout()}>
              Esci
            </Button>
          </div>
        </div>
      </div>
    )
  }
  if (!profile) return <Navigate to="/login" replace />

  return <Outlet />
}
