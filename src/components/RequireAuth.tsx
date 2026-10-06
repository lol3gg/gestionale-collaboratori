import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../hooks/useProfile'
import { Button } from './ui/Button'
import { FullPageSpinner } from './ui/Spinner'

export function RequireAuth() {
  const { profile, loading, error } = useProfile()
  const { logout } = useAuth()

  if (loading) return <FullPageSpinner />
  if (!profile && error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Profilo non disponibile</h1>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
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
