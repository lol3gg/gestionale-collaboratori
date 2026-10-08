import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  ActiveCollaboratorModal,
  CreateCollaboratorModal,
  EditCollaboratorModal,
} from '../components/collaborators/CollaboratorModals'
import { PageHeader } from '../components/layout/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { Table, type Column } from '../components/ui/Table'
import { useCollaborators } from '../hooks/useCollaborators'
import { useProfile } from '../hooks/useProfile'
import { roleLabel } from '../lib/labels'
import { errorMessage } from '../lib/validators'
import type { Collaborator } from '../types'

type Dialog =
  | { type: 'closed' }
  | { type: 'create' }
  | { type: 'edit'; collaborator: Collaborator }
  | { type: 'active'; collaborator: Collaborator }

export function CollaboratoriPage() {
  const { profile } = useProfile()
  const query = useCollaborators()
  const [dialog, setDialog] = useState<Dialog>({ type: 'closed' })
  const close = () => setDialog({ type: 'closed' })

  const columns: Column<Collaborator>[] = [
    {
      key: 'name',
      header: 'Nome',
      cell: (row) => <span className="font-medium text-ink">{row.full_name || '—'}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      cell: (row) => <span className="break-all">{row.email}</span>,
    },
    {
      key: 'role',
      header: 'Ruolo',
      cell: (row) => <Badge variant={row.role === 'admin' ? 'info' : 'neutral'}>{roleLabel(row.role)}</Badge>,
    },
    {
      key: 'status',
      header: 'Stato',
      cell: (row) => <Badge variant={row.active ? 'success' : 'danger'}>{row.active ? 'Attivo' : 'Disattivo'}</Badge>,
    },
    {
      key: 'companies',
      header: 'Aziende assegnate',
      className: 'text-right',
      cell: (row) => <span className="tabular-nums">{row.assigned_companies}</span>,
    },
    {
      key: 'calls',
      header: 'Chiamate',
      className: 'text-right',
      cell: (row) => <span className="tabular-nums">{row.calls_total}</span>,
    },
    {
      key: 'accepted',
      header: 'Accettate',
      className: 'text-right',
      cell: (row) => <span className="tabular-nums">{row.calls_accepted}</span>,
    },
    {
      key: 'rejected',
      header: 'Rifiutate',
      className: 'text-right',
      cell: (row) => <span className="tabular-nums">{row.calls_rejected}</span>,
    },
    {
      key: 'rate',
      header: 'Accettazione',
      className: 'text-right',
      cell: (row) => <span className="tabular-nums">{row.acceptance_rate === null ? '—' : `${row.acceptance_rate}%`}</span>,
    },
    {
      key: 'actions',
      header: 'Azioni',
      className: 'text-right',
      cell: (row) => {
        const self = profile?.id === row.id
        return (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" className="px-2" onClick={() => setDialog({ type: 'edit', collaborator: row })}>
              Modifica
            </Button>
            <Button
              variant="ghost"
              className="px-2"
              disabled={self}
              title={self ? 'Non puoi disattivare il tuo account' : undefined}
              onClick={() => setDialog({ type: 'active', collaborator: row })}
            >
              {row.active ? 'Disattiva' : 'Attiva'}
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <section>
      <PageHeader
        title="Collaboratori"
        description="Account con accesso all'applicazione"
        action={
          <Button onClick={() => setDialog({ type: 'create' })}>
            <Plus className="h-4 w-4" />
            Nuovo collaboratore
          </Button>
        }
      />

      {query.isPending ? (
        <div className="flex justify-center py-24">
          <Spinner className="h-8 w-8 text-primary-600" />
        </div>
      ) : null}

      {query.isError ? (
        <EmptyState
          title="Impossibile caricare i collaboratori"
          description={errorMessage(query.error)}
          action={<Button onClick={() => void query.refetch()}>Riprova</Button>}
        />
      ) : null}

      {query.isSuccess && query.data.length === 0 ? (
        <EmptyState title="Nessun collaboratore" description="Crea il primo account per iniziare." />
      ) : null}

      {query.isSuccess && query.data.length > 0 ? (
        <>
          <ul className="space-y-3 md:hidden">
            {query.data.map((row) => {
              const self = profile?.id === row.id
              return (
                <li key={row.id} className="card-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold tracking-tight text-ink">{row.full_name || '—'}</p>
                      <p className="mt-1 break-all text-[15px] text-muted">{row.email}</p>
                    </div>
                    <Badge variant={row.active ? 'success' : 'danger'}>{row.active ? 'Attivo' : 'Disattivo'}</Badge>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-[15px]">
                    <div>
                      <dt className="text-xs text-muted">Chiamate</dt>
                      <dd className="mt-1 tabular-nums text-ink">{row.calls_total}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Accettate</dt>
                      <dd className="mt-1 tabular-nums text-ink">{row.calls_accepted}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Rifiutate</dt>
                      <dd className="mt-1 tabular-nums text-ink">{row.calls_rejected}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Accettazione</dt>
                      <dd className="mt-1 tabular-nums text-ink">
                        {row.acceptance_rate === null ? '—' : `${row.acceptance_rate}%`}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button variant="secondary" className="min-h-11" onClick={() => setDialog({ type: 'edit', collaborator: row })}>
                      Modifica
                    </Button>
                    <Button
                      variant="secondary"
                      className="min-h-11"
                      disabled={self}
                      title={self ? 'Non puoi disattivare il tuo account' : undefined}
                      onClick={() => setDialog({ type: 'active', collaborator: row })}
                    >
                      {row.active ? 'Disattiva' : 'Attiva'}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="hidden md:block">
            <Table columns={columns} rows={query.data} getRowKey={(row) => row.id} />
          </div>
        </>
      ) : null}

      <CreateCollaboratorModal open={dialog.type === 'create'} onClose={close} />
      <EditCollaboratorModal
        collaborator={dialog.type === 'edit' ? dialog.collaborator : null}
        self={dialog.type === 'edit' && dialog.collaborator.id === profile?.id}
        onClose={close}
      />
      <ActiveCollaboratorModal collaborator={dialog.type === 'active' ? dialog.collaborator : null} onClose={close} />
    </section>
  )
}
