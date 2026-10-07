import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type PageTitleContextValue = {
  title: string
  setTitle: (title: string) => void
}

const PageTitleContext = createContext<PageTitleContextValue | null>(null)

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState('Gestione Collaboratori')
  const value = useMemo(() => ({ title, setTitle }), [title])
  return <PageTitleContext.Provider value={value}>{children}</PageTitleContext.Provider>
}

export function usePageTitle(title: string) {
  const context = useContext(PageTitleContext)
  useEffect(() => {
    if (!context) return
    context.setTitle(title)
  }, [context, title])
}

export function usePageTitleValue(): string {
  return useContext(PageTitleContext)?.title ?? 'Gestione Collaboratori'
}
