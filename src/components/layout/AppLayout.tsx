import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches)

  const closeIfPhone = () => {
    if (window.matchMedia('(min-width: 768px)').matches) return
    setOpen(false)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar open={open} onClose={() => setOpen(false)} onNavigate={closeIfPhone} />
      <div className={open ? 'md:pl-64' : ''}>
        <Header sidebarOpen={open} onOpenMenu={() => setOpen(true)} />
        <main className="px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
