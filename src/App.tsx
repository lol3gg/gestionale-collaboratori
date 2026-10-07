import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { RequireAuth } from './components/RequireAuth'
import { RequireRole } from './components/RequireRole'
import { FullPageSpinner } from './components/ui/Spinner'
import { useProfile } from './hooks/useProfile'
import { isDemoMode } from './lib/demo'
import { isSupabaseConfigured } from './lib/supabase'
import { AziendePage } from './pages/AziendePage'
import { CalendarioPage } from './pages/CalendarioPage'
import { ChiamatePage } from './pages/ChiamatePage'
import { CollaboratoriPage } from './pages/CollaboratoriPage'
import { DashboardPage } from './pages/DashboardPage'
import { LeMieAziendePage } from './pages/LeMieAziendePage'
import { LoginPage } from './pages/LoginPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { SetupPage } from './pages/SetupPage'

function AdminOnlyChiamate() {
  const { profile, loading } = useProfile()
  if (loading) return <FullPageSpinner />
  if (!profile) return <Navigate to="/login" replace />
  if (profile.role !== 'admin') return <Navigate to="/le-mie-aziende" replace />
  return <ChiamatePage />
}

export function App() {
  if (!isDemoMode && !isSupabaseConfigured) return <SetupPage />

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/chiamate" element={<AdminOnlyChiamate />} />
          <Route path="/calendario" element={<CalendarioPage />} />
          <Route element={<RequireRole role="admin" />}>
            <Route path="/aziende" element={<AziendePage />} />
            <Route path="/ricerca" element={<PlaceholderPage title="Ricerca" />} />
            <Route path="/collaboratori" element={<CollaboratoriPage />} />
          </Route>
          <Route element={<RequireRole role="collaboratore" />}>
            <Route path="/le-mie-aziende" element={<LeMieAziendePage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
