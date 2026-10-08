import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { useProfile } from '../../hooks/useProfile'
import { AUTH_BYPASS } from '../../lib/authBypass'
import { roleLabel } from '../../lib/labels'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { ThemeToggle } from '../ui/ThemeToggle'
import { DevologyLogo } from '../brand/DevologyLogo'
import { initialsFrom } from '../../lib/initials'
import { usePageTitleValue } from './PageTitleContext'
import { ProfileSheet } from '../profile/ProfileSheet'

export function Header() {
  const { profile } = useProfile()
  const { logout, realRole, viewingAsCollaborator, setViewAsCollaborator } = useAuth()
  const navigate = useNavigate()
  const title = usePageTitleValue()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const canSwitchRole = realRole === 'admin'

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

  const openProfile = () => {
    setMenuOpen(false)
    setProfileOpen(true)
  }

  const signOut = () => {
    setMenuOpen(false)
    void logout()
  }

  const switchToCollaborator = () => {
    setMenuOpen(false)
    setViewAsCollaborator(true)
    navigate('/le-mie-aziende', { replace: true })
  }

  const switchToAdmin = () => {
    setMenuOpen(false)
    setViewAsCollaborator(false)
    navigate('/dashboard', { replace: true })
  }

  return (
    <>
      <div className="sticky top-0 z-20 pt-[env(safe-area-inset-top)]">
        {viewingAsCollaborator ? (
          <div className="flex items-center justify-between gap-3 border-b border-warning-fg/20 bg-warning-bg px-4 py-2 text-[13px] text-warning-fg md:px-8">
            <p className="min-w-0 font-medium">Stai vedendo l’app come collaboratore</p>
            <button
              type="button"
              className="shrink-0 rounded-lg px-2 py-1 font-semibold underline-offset-2 hover:underline"
              onClick={switchToAdmin}
            >
              Torna ad admin
            </button>
          </div>
        ) : null}
        <header className="border-b border-line/90 glass-panel">
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
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-700 text-xs font-bold text-white shadow-sm transition-transform duration-150 active:scale-[0.98]"
                aria-label="Menu account"
                aria-expanded={menuOpen}
              >
                {initials}
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-12 z-30 w-56 overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-card animate-[fade-in_150ms_ease-out]">
                  <div className="border-b border-line px-3 py-2.5">
                    <p className="truncate text-sm font-medium text-ink">{displayName}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {roleLabel(profile.role)}
                      {viewingAsCollaborator ? ' (anteprima)' : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center px-3 text-left text-[15px] text-ink hover:bg-canvas"
                    onClick={openProfile}
                  >
                    Profilo
                  </button>
                  {canSwitchRole && !viewingAsCollaborator ? (
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center px-3 text-left text-[15px] text-ink hover:bg-canvas"
                      onClick={switchToCollaborator}
                    >
                      Vedi come collaboratore
                    </button>
                  ) : null}
                  {viewingAsCollaborator ? (
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center px-3 text-left text-[15px] text-ink hover:bg-canvas"
                      onClick={switchToAdmin}
                    >
                      Torna ad admin
                    </button>
                  ) : null}
                  {!AUTH_BYPASS ? (
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center px-3 text-left text-[15px] text-ink hover:bg-canvas"
                      onClick={signOut}
                    >
                      Esci
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="hidden w-full items-center justify-end gap-3 md:flex">
            <ThemeToggle compact className="min-h-10 w-10 px-0" />
            {canSwitchRole ? (
              <Button
                variant="secondary"
                className="shrink-0"
                onClick={viewingAsCollaborator ? switchToAdmin : switchToCollaborator}
              >
                {viewingAsCollaborator ? 'Torna ad admin' : 'Vedi come collaboratore'}
              </Button>
            ) : null}
            <button
              type="button"
              onClick={openProfile}
              className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 text-right transition-colors hover:bg-canvas"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{displayName}</p>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-700 text-xs font-bold text-white">
                {initials}
              </span>
            </button>
            <Badge variant={profile.role === 'admin' ? 'info' : 'neutral'}>
              {roleLabel(profile.role)}
              {viewingAsCollaborator ? ' · anteprima' : ''}
            </Badge>
            {!AUTH_BYPASS ? (
              <Button variant="secondary" className="shrink-0" onClick={signOut}>
                Esci
              </Button>
            ) : null}
          </div>
        </div>
      </header>
      </div>
      <ProfileSheet open={profileOpen} profile={profile} onClose={() => setProfileOpen(false)} />
    </>
  )
}
