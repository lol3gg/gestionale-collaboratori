import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type ToastType = 'success' | 'error'

export type ToastAction = {
  label: string
  onClick: () => void
}

type ToastItem = {
  id: string
  type: ToastType
  message: string
  action?: ToastAction
}

type ToastContextValue = {
  success: (message: string, action?: ToastAction) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback((type: ToastType, message: string, action?: ToastAction) => {
    const id = crypto.randomUUID()
    setToasts((current) => [...current.slice(-2), { id, type, message, action }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, action ? 8000 : type === 'error' ? 6000 : 4000)
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message, action) => push('success', message, action),
      error: (message) => push('error', message),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-0 z-[60] flex w-full max-w-sm flex-col gap-2 px-4 md:bottom-4 md:left-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-[15px] shadow-card ring-1 animate-[fade-in_150ms_ease-out] ${
              toast.type === 'success'
                ? 'bg-success-bg text-success-fg ring-success-dot/20'
                : 'bg-danger-bg text-danger-fg ring-danger-dot/20'
            }`}
          >
            <span>{toast.message}</span>
            {toast.action ? (
              <button
                type="button"
                className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold underline-offset-2 hover:underline"
                onClick={() => {
                  toast.action?.onClick()
                  dismiss(toast.id)
                }}
              >
                {toast.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast deve essere usato dentro ToastProvider')
  return context
}
