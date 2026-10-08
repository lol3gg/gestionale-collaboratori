import type { CompanyStatus } from '../types'
import type { BadgeVariant } from '../components/ui/Badge'

/** Un significato = un colore (allineato ai token CSS). */
export const statusBadgeVariant: Record<CompanyStatus, BadgeVariant> = {
  da_chiamare: 'quiet',
  non_risponde: 'warning',
  da_richiamare: 'violet',
  accettato: 'success',
  rifiutato: 'danger',
  numero_errato: 'quiet',
}

export const statusAccentVar: Record<CompanyStatus, string> = {
  da_chiamare: 'var(--color-quiet-dot)',
  non_risponde: 'var(--color-warning-dot)',
  da_richiamare: 'var(--color-violet-dot)',
  accettato: 'var(--color-success-dot)',
  rifiutato: 'var(--color-danger-dot)',
  numero_errato: 'var(--color-quiet-dot)',
}

export const statusEdgeClass: Record<CompanyStatus, string> = {
  da_chiamare: 'status-edge status-edge-quiet',
  non_risponde: 'status-edge status-edge-warning',
  da_richiamare: 'status-edge status-edge-violet',
  accettato: 'status-edge status-edge-success',
  rifiutato: 'status-edge status-edge-danger',
  numero_errato: 'status-edge status-edge-quiet',
}

/** Pulsanti esito: outline neutro + testo/tinta semantica. */
export function outcomeButtonClass(outcome: CompanyStatus | 'da_richiamare'): string {
  const base =
    'min-h-11 border border-line bg-surface px-2 text-sm font-semibold shadow-sm hover:bg-canvas active:scale-[0.98]'
  switch (outcome) {
    case 'accettato':
      return `${base} border-transparent bg-success-dot text-white hover:brightness-95`
    case 'rifiutato':
      return `${base} text-danger-fg`
    case 'da_richiamare':
      return `${base} text-violet-fg`
    case 'non_risponde':
      return `${base} text-warning-fg`
    default:
      return `${base} text-ink`
  }
}
