import type { ReactNode } from 'react'

export type BadgeVariant = 'success' | 'neutral' | 'danger' | 'info' | 'warning' | 'accent' | 'yellow' | 'orange' | 'dark'

const variants: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500 text-white ring-emerald-600',
  neutral: 'bg-slate-200 text-slate-800 ring-slate-300',
  danger: 'bg-red-500 text-white ring-red-600',
  info: 'bg-indigo-500 text-white ring-indigo-600',
  warning: 'bg-amber-400 text-amber-950 ring-amber-500',
  accent: 'bg-violet-500 text-white ring-violet-600',
  yellow: 'bg-yellow-400 text-yellow-950 ring-yellow-500',
  orange: 'bg-orange-500 text-white ring-orange-600',
  dark: 'bg-slate-900 text-white ring-slate-950',
}

export function Badge({
  children,
  variant = 'neutral',
  className = '',
}: {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}
