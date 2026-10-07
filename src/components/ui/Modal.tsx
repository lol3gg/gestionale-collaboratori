import { useEffect, useRef, type ReactNode, type TouchEvent } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

type ModalProps = {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg' | 'xl'
}

const widths = {
  md: 'md:max-w-md',
  lg: 'md:max-w-2xl',
  xl: 'md:max-w-4xl',
}

export function Modal({ open, title, description, onClose, children, footer, size = 'md' }: ModalProps) {
  const startY = useRef<number | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  const onTouchStart = (event: TouchEvent) => {
    startY.current = event.touches[0]?.clientY ?? null
  }

  const onTouchEnd = (event: TouchEvent) => {
    if (startY.current == null) return
    const endY = event.changedTouches[0]?.clientY ?? startY.current
    if (endY - startY.current > 80) onClose()
    startY.current = null
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] animate-[fade-in_150ms_ease-out]"
        aria-label="Chiudi"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={`relative z-10 flex max-h-[92vh] w-full flex-col rounded-t-[1.25rem] bg-surface p-5 shadow-lift animate-[sheet-up_180ms_ease-out] md:max-h-[90vh] md:rounded-2xl md:p-6 md:shadow-xl md:animate-[fade-in_150ms_ease-out] ${widths[size]}`}
      >
        <div className="mb-3 flex justify-center md:hidden">
          <span className="h-1 w-10 rounded-full bg-line" aria-hidden="true" />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-lg font-semibold tracking-tight text-ink">
              {title}
            </h2>
            {description ? <p className="mt-1 text-[15px] text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition duration-150 hover:bg-canvas hover:text-ink"
            aria-label="Chiudi finestra"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 overflow-y-auto overscroll-contain">{children}</div>
        {footer ? <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}
