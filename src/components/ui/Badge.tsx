import type { ReactNode } from 'react'

export type BadgeVariant = 'success' | 'quiet' | 'neutral' | 'danger' | 'info' | 'warning' | 'violet' | 'accent'

const variants: Record<BadgeVariant, { wrap: string; dot: string }> = {
  success: { wrap: 'bg-success-bg text-success-fg', dot: 'bg-success-dot' },
  quiet: { wrap: 'bg-quiet-bg text-quiet-fg', dot: 'bg-quiet-dot' },
  neutral: { wrap: 'bg-quiet-bg text-quiet-fg', dot: 'bg-quiet-dot' },
  danger: { wrap: 'bg-danger-bg text-danger-fg', dot: 'bg-danger-dot' },
  info: { wrap: 'bg-primary-50 text-primary-700', dot: 'bg-primary-500' },
  warning: { wrap: 'bg-warning-bg text-warning-fg', dot: 'bg-warning-dot' },
  violet: { wrap: 'bg-violet-bg text-violet-fg', dot: 'bg-violet-dot' },
  accent: { wrap: 'bg-primary-50 text-primary-700', dot: 'bg-primary-500' },
}

export function Badge({
  children,
  variant = 'neutral',
  className = '',
  showDot = true,
}: {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
  showDot?: boolean
}) {
  const style = variants[variant]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${style.wrap} ${className}`}
    >
      {showDot ? <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" /> : null}
      {children}
    </span>
  )
}
