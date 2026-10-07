import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../theme/ThemeProvider'

type ThemeToggleProps = {
  className?: string
  compact?: boolean
}

export function ThemeToggle({ className = '', compact = false }: ThemeToggleProps) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink shadow-sm transition duration-200 hover:border-primary-300 hover:bg-primary-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${className}`}
      aria-label={isDark ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
      title={isDark ? 'Tema chiaro' : 'Tema scuro'}
    >
      {isDark ? <Sun className="h-4 w-4 text-primary-500" aria-hidden="true" /> : <Moon className="h-4 w-4 text-muted" aria-hidden="true" />}
      {compact ? null : <span>{isDark ? 'Chiaro' : 'Scuro'}</span>}
    </button>
  )
}
