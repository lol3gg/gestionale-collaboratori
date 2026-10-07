import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { Header } from './Header'
import { PageTitleProvider } from './PageTitleContext'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  return (
    <PageTitleProvider>
      <div className="min-h-screen">
        <Sidebar />
        <div className="md:pl-64">
          <Header />
          <main className="page-enter w-full min-w-0 px-4 py-5 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:px-8 md:py-8 md:pb-8">
            <Outlet />
          </main>
        </div>
        <BottomNav />
      </div>
    </PageTitleProvider>
  )
}
