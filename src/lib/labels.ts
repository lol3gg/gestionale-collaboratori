import type { CompanyStatus, UserRole } from '../types'

const statusLabels: Record<CompanyStatus, string> = {
  da_chiamare: 'Da chiamare',
  non_risponde: 'Non risponde',
  da_richiamare: 'Da richiamare',
  accettato: 'Accettato',
  rifiutato: 'Rifiutato',
  numero_errato: 'Numero errato',
}

export function statusLabel(status: CompanyStatus): string {
  return statusLabels[status]
}

export function roleLabel(role: UserRole): string {
  return role === 'admin' ? 'Amministratore' : 'Collaboratore'
}
