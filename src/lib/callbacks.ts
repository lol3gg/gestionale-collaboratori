/** Inizio giornata locale (per confrontare richiami scaduti / oggi). */
export function startOfLocalDay(date = new Date()): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export function endOfLocalDay(date = new Date()): Date {
  const next = startOfLocalDay(date)
  next.setDate(next.getDate() + 1)
  return next
}

export function isCallbackOverdue(callbackAt: string | null | undefined): boolean {
  if (!callbackAt) return false
  const at = new Date(callbackAt)
  if (Number.isNaN(at.getTime())) return false
  return at.getTime() < startOfLocalDay().getTime()
}

export function isCallbackToday(callbackAt: string | null | undefined): boolean {
  if (!callbackAt) return false
  const at = new Date(callbackAt)
  if (Number.isNaN(at.getTime())) return false
  const start = startOfLocalDay().getTime()
  const end = endOfLocalDay().getTime()
  return at.getTime() >= start && at.getTime() < end
}

export function formatCallbackTime(callbackAt: string): string {
  const at = new Date(callbackAt)
  if (Number.isNaN(at.getTime())) return '—'
  return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(at)
}
