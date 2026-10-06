import { Menu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { useProfile } from '../../hooks/useProfile'
import { roleLabel } from '../../lib/labels'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'

export function Header({ sidebarOpen, onOpenMenu }: { sidebarOpen: boolean; onOpenMenu: () => void }) {
  const { profile } = useProfile()
  const { isDemo, logout } = useAuth()
  const navigate = useNavigate()
  if (!profile) return null

  const changeRole = () => {
    void logout().then(() => navigate('/login'))
  }

  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center gap-2 border-b border-slate-200 bg-white/90 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:px-8">
      <button
        type="button"
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 ${sidebarOpen ? 'md:hidden' : ''}`}
        onClick={onOpenMenu}
        aria-label="Apri menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1 md:text-right">
        <p className="truncate text-sm font-medium text-slate-900">{profile.full_name || profile.email}</p>
        <p className="truncate text-xs text-slate-500 md:hidden">
          {isDemo ? `Demo · ${roleLabel(profile.role)}` : roleLabel(profile.role)}
        </p>
      </div>
      {isDemo ? (
        <span className="hidden md:inline-flex">
          <Badge variant="warning" className="px-2.5 py-1 text-xs font-bold tracking-wide">
            DEMO · {roleLabel(profile.role)}
          </Badge>
        </span>
      ) : (
        <span className="hidden md:inline-flex">
          <Badge variant={profile.role === 'admin' ? 'info' : 'neutral'}>{roleLabel(profile.role)}</Badge>
        </span>
      )}
      {isDemo ? (
        <Button variant="secondary" className="shrink-0 px-3" onClick={changeRole}>
          <span className="sm:hidden">Ruolo</span>
          <span className="hidden sm:inline">Cambia ruolo</span>
        </Button>
      ) : (
        <Button variant="secondary" className="shrink-0 px-3" onClick={() => void logout()}>
          Esci
        </Button>
      )}
    </header>
  )
}
