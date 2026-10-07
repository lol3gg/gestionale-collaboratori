import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useProfile } from '../../hooks/useProfile'
import { adminNav, collaboratorNav, type NavItem } from './nav'

const MOBILE_PRIMARY_COUNT = 5

function TabItem({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <NavLink
      to={item.to}
      className={`relative flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 px-1 transition-colors duration-150 ${
        active ? 'text-primary-600' : 'text-muted'
      }`}
    >
      {active ? (
        <span className="absolute top-1 h-1 w-4 rounded-full bg-gradient-to-r from-primary-400 to-primary-700 transition-opacity duration-150" aria-hidden="true" />
      ) : null}
      <item.icon className="h-5 w-5" aria-hidden="true" strokeWidth={active ? 2.25 : 1.75} />
      <span className="max-w-full truncate text-center text-[11px] font-medium leading-tight">{item.label}</span>
    </NavLink>
  )
}

function AltroSheet({
  open,
  items,
  onClose,
}: {
  open: boolean
  items: NavItem[]
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[55] md:hidden">
      <button type="button" className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" aria-label="Chiudi" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Altro"
        className="absolute inset-x-0 bottom-0 animate-[sheet-up_180ms_ease-out] rounded-t-[1.25rem] bg-surface pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lift"
      >
        <div className="flex justify-center pt-3 pb-2">
          <span className="h-1 w-10 rounded-full bg-line" aria-hidden="true" />
        </div>
        <p className="px-5 pb-2 text-sm font-semibold tracking-tight text-ink">Altro</p>
        <nav className="flex flex-col px-2 pb-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex min-h-12 items-center gap-3 rounded-xl px-4 text-[15px] font-medium transition-colors duration-150 ${
                  isActive ? 'bg-primary-50 text-primary-700' : 'text-ink hover:bg-canvas'
                }`
              }
            >
              <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>,
    document.body,
  )
}

export function BottomNav() {
  const { profile } = useProfile()
  const location = useLocation()
  const [altroOpen, setAltroOpen] = useState(false)

  if (!profile) return null

  const items = profile.role === 'admin' ? adminNav : collaboratorNav
  const needsAltro = profile.role === 'admin' && items.length > MOBILE_PRIMARY_COUNT
  const primary = needsAltro ? items.slice(0, MOBILE_PRIMARY_COUNT) : items
  const overflow = needsAltro ? items.slice(MOBILE_PRIMARY_COUNT) : []
  const overflowActive = overflow.some((item) => location.pathname.startsWith(item.to))

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-surface/85 pb-[env(safe-area-inset-bottom)] shadow-lift backdrop-blur-xl md:hidden"
        aria-label="Navigazione principale"
      >
        <div className="flex h-16 items-stretch justify-around px-1">
          {primary.map((item) => (
            <TabItem key={item.to} item={item} active={location.pathname.startsWith(item.to)} />
          ))}
          {needsAltro ? (
            <button
              type="button"
              onClick={() => setAltroOpen(true)}
              className={`relative flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 px-1 transition-colors duration-150 ${
                overflowActive ? 'text-primary-600' : 'text-muted'
              }`}
              aria-label="Altro"
            >
              {overflowActive ? (
                <span className="absolute top-1 h-1 w-4 rounded-full bg-gradient-to-r from-primary-400 to-primary-700" aria-hidden="true" />
              ) : null}
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" strokeWidth={overflowActive ? 2.25 : 1.75} />
              <span className="text-[11px] font-medium leading-tight">Altro</span>
            </button>
          ) : null}
        </div>
      </nav>
      <AltroSheet open={altroOpen} items={overflow} onClose={() => setAltroOpen(false)} />
    </>
  )
}
