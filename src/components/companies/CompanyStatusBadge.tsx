import type { CompanyStatus } from '../../types'
import { statusLabel } from '../../lib/labels'
import { statusBadgeVariant } from '../../lib/statusColors'
import { Badge } from '../ui/Badge'

export function CompanyStatusBadge({ status }: { status: CompanyStatus }) {
  const struck = status === 'numero_errato'
  return (
    <Badge variant={statusBadgeVariant[status]} className={struck ? 'line-through decoration-quiet-fg/50' : ''}>
      {statusLabel(status)}
    </Badge>
  )
}
