import { NavLink } from 'react-router-dom'
import { useProfile } from '../../hooks/useProfile'
import { adminNav, collaboratorNav } from './nav'

export function Sidebar() {
  const { profile } = useProfile()
  const items = profile?.role === 'admin' ? adminNav : collaboratorNav

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface md:flex">
      <div className="flex h-16 items-center gap-3 border-b border-line/80 px-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-sm font-semibold text-white">
          GC
        </span>
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-semibold tracking-tight text-ink">Gestione</p>
          <p className="text-xs text-muted">Collaboratori</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-[15px] font-medium transition-colors duration-150 ${
                isActive ? 'bg-primary-50 text-primary-700' : 'text-muted hover:bg-canvas hover:text-ink'
              }`
            }
          >
            <item.icon className="h-[18px] w-[18px]" aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
