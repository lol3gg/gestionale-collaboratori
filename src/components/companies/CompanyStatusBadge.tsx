import type { CompanyStatus } from '../../types'
import { statusLabel } from '../../lib/labels'
import { Badge, type BadgeVariant } from '../ui/Badge'

const variants: Record<CompanyStatus, BadgeVariant> = {
  da_chiamare: 'neutral',
  non_risponde: 'yellow',
  da_richiamare: 'orange',
  accettato: 'success',
  rifiutato: 'danger',
  numero_errato: 'dark',
}

export function CompanyStatusBadge({ status }: { status: CompanyStatus }) {
  return <Badge variant={variants[status]}>{statusLabel(status)}</Badge>
}
