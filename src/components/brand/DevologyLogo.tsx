import { useId } from 'react'

type DevologyLogoProps = {
  className?: string
  markClassName?: string
  showWordmark?: boolean
  compact?: boolean
  /** Animazioni leggere per la schermata di accesso. */
  hero?: boolean
}

export function DevologyLogo({
  className = '',
  markClassName = 'h-9 w-9',
  showWordmark = true,
  compact = false,
  hero = false,
}: DevologyLogoProps) {
  const uid = useId().replace(/:/g, '')
  const bgId = `dvy-bg-${uid}`
  const rimId = `dvy-rim-${uid}`
  const sheenId = `dvy-sheen-${uid}`
  const glyphId = `dvy-glyph-${uid}`
  const nodeId = `dvy-node-${uid}`

  return (
    <div className={`flex items-center gap-2.5 ${hero ? 'flex-col gap-4 text-center' : ''} ${className}`}>
      <span
        className={`logo-mark relative shrink-0 ${markClassName} ${hero ? 'logo-mark--hero' : ''}`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 64 64" className="h-full w-full" fill="none">
          <defs>
            <linearGradient id={bgId} x1="6" y1="2" x2="58" y2="62" gradientUnits="userSpaceOnUse">
              <stop stopColor="#1E346E" />
              <stop offset="0.42" stopColor="#2A52D6" />
              <stop offset="1" stopColor="#5E86F7" />
            </linearGradient>
            <linearGradient id={rimId} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
              <stop stopColor="#BCD0FF" stopOpacity="0.7" />
              <stop offset="0.55" stopColor="#8FAEFF" stopOpacity="0.25" />
              <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id={sheenId} x1="10" y1="4" x2="44" y2="36" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFFFFF" stopOpacity="0.38" />
              <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={glyphId} x1="18" y1="14" x2="48" y2="50" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#DCE6FF" />
            </linearGradient>
            <radialGradient id={nodeId} cx="50%" cy="50%" r="50%">
              <stop stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#BCD0FF" />
            </radialGradient>
          </defs>

          {/* Soft outer glow disc */}
          <circle cx="32" cy="32" r="30" fill={`url(#${bgId})`} opacity="0.18" className="logo-glow-disc" />

          {/* Mark plate */}
          <rect width="64" height="64" rx="18" fill={`url(#${bgId})`} />
          <rect x="2.5" y="2.5" width="59" height="59" rx="16.5" stroke={`url(#${rimId})`} strokeWidth="1.5" />

          {/* Specular sheen */}
          <path
            d="M8 22C16 8 40 5 54 16"
            stroke={`url(#${sheenId})`}
            strokeWidth="11"
            strokeLinecap="round"
            opacity="0.65"
            className="logo-sheen"
          />

          {/* Network arc (collaboratori) */}
          <path
            d="M42 18c6.5 4.2 9.8 11.4 8.6 19.2"
            stroke="#BCD0FF"
            strokeOpacity="0.55"
            strokeWidth="1.4"
            strokeLinecap="round"
            className="logo-orbit"
          />
          <path
            d="M44.5 15.5c8.2 5.4 12.2 14.4 10.4 23.8"
            stroke="#8FAEFF"
            strokeOpacity="0.28"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeDasharray="2.5 3.5"
            className="logo-orbit logo-orbit--slow"
          />

          {/* Geometric D */}
          <path
            d="M19 15h13.8c9.1 0 15.4 5.8 15.4 17S41.9 49 32.8 49H19V15Zm6.8 6.2v21.6h6.8c5.3 0 8.7-3.4 8.7-10.8s-3.4-10.8-8.7-10.8h-6.8Z"
            fill={`url(#${glyphId})`}
          />
          {/* Spine accent */}
          <path d="M19 15v34" stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="2.2" strokeLinecap="round" />

          {/* Collaboration nodes */}
          <circle cx="42.2" cy="17.2" r="2.35" fill={`url(#${nodeId})`} className="logo-node logo-node--a" />
          <circle cx="50.2" cy="28.5" r="1.9" fill={`url(#${nodeId})`} className="logo-node logo-node--b" />
          <circle cx="49.4" cy="40.8" r="1.55" fill={`url(#${nodeId})`} className="logo-node logo-node--c" />
        </svg>
      </span>

      {showWordmark ? (
        <div className={`min-w-0 leading-tight ${hero ? 'items-center' : ''}`}>
          <p
            className={
              hero
                ? 'brand-gradient-text text-[2rem] font-extrabold tracking-tight sm:text-[2.35rem]'
                : 'truncate text-[15px] font-semibold tracking-tight text-ink'
            }
          >
            Devology
          </p>
          {!compact ? (
            <p
              className={
                hero
                  ? 'mt-1 text-[13px] font-medium uppercase tracking-[0.14em] text-muted'
                  : 'truncate text-[11px] font-medium uppercase tracking-[0.1em] text-muted'
              }
            >
              Collaboratori
            </p>
          ) : null}
        </div>
      ) : null}
      <span className="sr-only">Devology</span>
    </div>
  )
}
