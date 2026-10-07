export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
      role="status"
      aria-label="Caricamento"
    />
  )
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas">
      <Spinner className="h-8 w-8 text-primary-600" />
      <p className="text-sm text-muted">Caricamento…</p>
    </div>
  )
}
