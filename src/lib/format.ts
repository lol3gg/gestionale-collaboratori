export const AUTH_NOTICE_KEY = 'gc_auth_notice'

export function consumeAuthNotice(): string | null {
  const notice = sessionStorage.getItem(AUTH_NOTICE_KEY)
  if (notice) sessionStorage.removeItem(AUTH_NOTICE_KEY)
  return notice
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium' }).format(date)
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
