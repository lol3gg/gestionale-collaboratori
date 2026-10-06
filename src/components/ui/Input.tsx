import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'

export const controlClassName =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50'

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
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`${controlClassName} ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''} ${className}`}
        {...props}
      />
      {error ? (
        <span id={errorId} className="mt-1.5 block text-sm text-red-600">
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
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${controlClassName} ${error ? 'border-red-400' : ''} ${className}`}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <span id={`${selectId}-error`} className="mt-1.5 block text-sm text-red-600">
          {error}
        </span>
      ) : null}
      {!error && hint ? (
        <span id={`${selectId}-hint`} className="mt-1.5 block text-sm text-slate-500">
          {hint}
        </span>
      ) : null}
    </label>
  )
}
