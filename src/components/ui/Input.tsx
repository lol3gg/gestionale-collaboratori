import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'

export const controlClassName =
  'w-full min-h-11 rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-ink shadow-sm outline-none transition duration-150 placeholder:text-muted/70 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:bg-canvas'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
}

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`
  return (
    <label className="block" htmlFor={inputId}>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`${controlClassName} ${error ? 'border-danger-dot focus:border-danger-dot focus:ring-danger-dot/20' : ''} ${className}`}
        {...props}
      />
      {error ? (
        <span id={errorId} className="mt-1.5 block text-sm text-danger-fg">
          {error}
        </span>
      ) : null}
    </label>
  )
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  error?: string
  hint?: string
  children: ReactNode
}

export function Select({ label, error, hint, id, className = '', children, ...props }: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const describedBy = error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined
  return (
    <label className="block" htmlFor={selectId}>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${controlClassName} ${error ? 'border-danger-dot' : ''} ${className}`}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <span id={`${selectId}-error`} className="mt-1.5 block text-sm text-danger-fg">
          {error}
        </span>
      ) : null}
      {!error && hint ? (
        <span id={`${selectId}-hint`} className="mt-1.5 block text-sm text-muted">
          {hint}
        </span>
      ) : null}
    </label>
  )
}
