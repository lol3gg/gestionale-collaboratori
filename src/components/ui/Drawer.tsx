import { useEffect, useRef, type ReactNode, type TouchEvent } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

type DrawerProps = {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
}

export function Drawer({ open, title, description, onClose, children }: DrawerProps) {
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
    <div className="fixed inset-0 z-50 flex items-end justify-end md:items-stretch">
      <button
        type="button"
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] animate-[fade-in_150ms_ease-out]"
        aria-label="Chiudi"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative z-10 flex max-h-[92vh] w-full flex-col rounded-t-[1.25rem] bg-surface shadow-lift animate-[sheet-up_180ms_ease-out] md:h-full md:max-h-none md:max-w-lg md:rounded-none md:shadow-xl md:animate-none"
      >
        <div className="flex justify-center pt-3 md:hidden">
          <span className="h-1 w-10 rounded-full bg-line" aria-hidden="true" />
        </div>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id="drawer-title" className="text-lg font-semibold tracking-tight text-ink">
              {title}
            </h2>
            {description ? <p className="mt-1 text-[15px] text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition duration-150 hover:bg-canvas hover:text-ink"
            aria-label="Chiudi pannello"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
      </aside>
    </div>,
    document.body,
  )
}
