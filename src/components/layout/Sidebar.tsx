import { NavLink } from 'react-router-dom'
import { useProfile } from '../../hooks/useProfile'
import { DevologyLogo } from '../brand/DevologyLogo'
import { adminNav, collaboratorNav } from './nav'

export function Sidebar() {
  const { profile } = useProfile()
  const items = profile?.role === 'admin' ? adminNav : collaboratorNav

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line glass-panel md:flex">
      <div className="flex h-16 items-center border-b border-line px-5">
        <DevologyLogo />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
        {items.map((item, index) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={{ animationDelay: `${index * 40}ms` }}
            className={({ isActive }) =>
              `page-enter relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-[15px] font-medium tracking-tight transition-all duration-200 ${
                isActive
                  ? 'bg-primary-50 text-primary-700 shadow-sm ring-1 ring-primary-200'
                  : 'text-muted hover:bg-canvas hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive ? (
                  <span
                    className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-primary-400 to-primary-700"
                    aria-hidden="true"
                  />
                ) : null}
                <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" strokeWidth={isActive ? 2.25 : 1.75} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-line px-5 py-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Powered by</p>
        <p className="mt-0.5 text-sm font-semibold tracking-tight text-ink">Devology System</p>
      </div>
    </aside>
  )
}
