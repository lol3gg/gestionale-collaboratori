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
  const bgId = `devology-bg-${uid}`
  const sheenId = `devology-sheen-${uid}`
  const dId = `devology-d-${uid}`

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className={`logo-mark relative shrink-0 ${markClassName}`} aria-hidden="true">
        <svg viewBox="0 0 64 64" className="h-full w-full drop-shadow-sm" fill="none">
          <defs>
            <linearGradient id={bgId} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
              <stop stopColor="#1E346E" />
              <stop offset="0.45" stopColor="#2A52D6" />
              <stop offset="1" stopColor="#2342AE" />
            </linearGradient>
            <linearGradient id={sheenId} x1="12" y1="6" x2="40" y2="28" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFFFFF" stopOpacity="0.28" />
              <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={dId} x1="18" y1="14" x2="46" y2="50" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#DCE6FF" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="18" fill={`url(#${bgId})`} />
          <rect x="3" y="3" width="58" height="58" rx="16" stroke="#8FAEFF" strokeOpacity="0.4" strokeWidth="1.5" />
          <path
            d="M10 18C18 8 46 6 54 18"
            stroke={`url(#${sheenId})`}
            strokeWidth="10"
            strokeLinecap="round"
            opacity="0.55"
          />
          <path
            d="M20 16h14.5c8.4 0 14.2 5.4 14.2 16S42.9 48 34.5 48H20V16Zm7 6.5v19h7.3c4.8 0 7.9-3.1 7.9-9.5s-3.1-9.5-7.9-9.5H27Z"
            fill={`url(#${dId})`}
          />
          <path d="M20 16v32" stroke="#BCD0FF" strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round" />
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
