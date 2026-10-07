import { useId } from 'react'

type DevologyLogoProps = {
  className?: string
  markClassName?: string
  showWordmark?: boolean
  compact?: boolean
}

export function DevologyLogo({
  className = '',
  markClassName = 'h-9 w-9',
  showWordmark = true,
  compact = false,
}: DevologyLogoProps) {
  const uid = useId().replace(/:/g, '')
  const gradId = `devology-grad-${uid}`

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className={`logo-mark relative shrink-0 ${markClassName}`} aria-hidden="true">
        <svg viewBox="0 0 40 40" className="h-full w-full" fill="none">
          <defs>
            <linearGradient id={gradId} x1="6" y1="4" x2="34" y2="36" gradientUnits="userSpaceOnUse">
              <stop stopColor="#34D399" />
              <stop offset="0.55" stopColor="#10B981" />
              <stop offset="1" stopColor="#047857" />
            </linearGradient>
          </defs>
          <rect width="40" height="40" rx="12" fill={`url(#${gradId})`} />
          <path
            d="M13 10.5h8.2c5.1 0 8.6 3.2 8.6 9.5s-3.5 9.5-8.6 9.5H13V10.5Zm4.1 3.5v12h4c2.9 0 4.7-1.9 4.7-6s-1.8-6-4.7-6h-4Z"
            fill="#FFFFFF"
          />
        </svg>
      </span>
      {showWordmark ? (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[15px] font-semibold tracking-tight text-ink">Devology</p>
          {!compact ? (
            <p className="truncate text-[11px] font-medium uppercase tracking-[0.1em] text-muted">Collaboratori</p>
          ) : null}
        </div>
      ) : null}
      <span className="sr-only">Devology</span>
    </div>
  )
}
