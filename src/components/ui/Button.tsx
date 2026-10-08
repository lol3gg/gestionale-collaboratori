import type { ButtonHTMLAttributes } from 'react'
import { Spinner } from './Spinner'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  loading?: boolean
}

const variants: Record<ButtonVariant, string> = {
  primary: 'btn-primary-solid font-semibold active:scale-[0.98]',
  secondary:
    'border border-line bg-surface text-ink shadow-sm hover:border-primary-300 hover:bg-primary-50 active:scale-[0.98]',
  danger: 'border border-danger-dot/25 bg-danger-bg text-danger-fg hover:brightness-95 active:scale-[0.98]',
  ghost: 'bg-transparent text-muted hover:bg-canvas hover:text-ink',
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold tracking-tight transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${variants[variant]} ${className}`}
      {...props}
    >
      {loading ? <Spinner className="h-4 w-4" /> : null}
      {children}
    </button>
  )
}
