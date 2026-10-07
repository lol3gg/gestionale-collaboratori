import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { useProfile } from '../../hooks/useProfile'
import { roleLabel } from '../../lib/labels'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { ThemeToggle } from '../ui/ThemeToggle'
import { DevologyLogo } from '../brand/DevologyLogo'
import { initialsFrom } from '../../lib/initials'
import { usePageTitleValue } from './PageTitleContext'

export function Header() {
  const { profile } = useProfile()
  const { isDemo, logout } = useAuth()
  const navigate = useNavigate()
  const title = usePageTitleValue()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  if (!profile) return null

  const displayName = profile.full_name || profile.email
  const initials = initialsFrom(displayName)

  const changeRole = () => {
    setMenuOpen(false)
    void logout().then(() => navigate('/login'))
  }

  const signOut = () => {
    setMenuOpen(false)
    void logout()
  }

  return (
    <header className="sticky top-0 z-20 border-b border-line/90 glass-panel pt-[env(safe-area-inset-top)]">
      <div className="relative flex h-14 w-full min-w-0 items-center px-4 md:h-16 md:px-8">
        <div className="flex w-full items-center md:hidden">
          <div className="w-11 shrink-0">
            <DevologyLogo showWordmark={false} markClassName="h-8 w-8" />
          </div>
          <h1 className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold tracking-tight text-ink">
            {title}
          </h1>
          <div className="relative flex w-auto shrink-0 items-center gap-1.5" ref={menuRef}>
            <ThemeToggle compact className="min-h-9 w-9 px-0" />
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-700 text-xs font-bold text-ink shadow-sm transition-transform duration-150 active:scale-[0.98]"
              aria-label="Menu account"
              aria-expanded={menuOpen}
            >
              {initials}
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-12 z-30 w-52 overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-card animate-[fade-in_150ms_ease-out]">
                <div className="border-b border-line px-3 py-2.5">
                  <p className="truncate text-sm font-medium text-ink">{displayName}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {isDemo ? `Demo · ${roleLabel(profile.role)}` : roleLabel(profile.role)}
                  </p>
                </div>
                {isDemo ? (
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center px-3 text-left text-[15px] text-ink hover:bg-canvas"
                    onClick={changeRole}
                  >
                    Cambia ruolo
                  </button>
                ) : (
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center px-3 text-left text-[15px] text-ink hover:bg-canvas"
                    onClick={signOut}
                  >
                    Esci
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="hidden w-full items-center justify-end gap-3 md:flex">
          <ThemeToggle compact className="min-h-10 w-10 px-0" />
          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-medium text-ink">{displayName}</p>
          </div>
          {isDemo ? (
            <Badge variant="warning" className="px-2.5 py-1 text-xs font-bold tracking-wide">
              DEMO · {roleLabel(profile.role)}
            </Badge>
          ) : (
            <Badge variant={profile.role === 'admin' ? 'info' : 'neutral'}>{roleLabel(profile.role)}</Badge>
          )}
          {isDemo ? (
            <Button variant="secondary" className="shrink-0" onClick={changeRole}>
              Cambia ruolo
            </Button>
          ) : (
            <Button variant="secondary" className="shrink-0" onClick={signOut}>
              Esci
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
