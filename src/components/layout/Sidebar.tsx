import { X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useProfile } from '../../hooks/useProfile'
import { adminNav, collaboratorNav } from './nav'

type SidebarProps = {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { profile } = useProfile()
  const items = profile?.role === 'admin' ? adminNav : collaboratorNav

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(18rem,86vw)] flex-col border-r border-slate-200 bg-white transition-transform duration-200 md:w-64 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-semibold text-white">
            GC
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-sm font-semibold text-slate-900">Gestione</p>
            <p className="text-xs text-slate-500">Collaboratori</p>
          </div>
          <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
            onClick={onClose}
            aria-label="Chiudi menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <item.icon className="h-[18px] w-[18px]" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}
