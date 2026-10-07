import type { ReactNode } from 'react'
import { usePageTitle } from './PageTitleContext'

type PageHeaderProps = {
  title: string
  description?: string
  action?: ReactNode
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  usePageTitle(title)

  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="hidden text-[1.65rem] font-semibold tracking-tight text-ink md:block">{title}</h1>
        {description ? <p className="text-[15px] leading-relaxed text-muted md:mt-1.5">{description}</p> : null}
      </div>
      {action ? <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">{action}</div> : null}
    </div>
  )
}
