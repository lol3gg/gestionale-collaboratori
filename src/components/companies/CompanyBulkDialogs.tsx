import { useState } from 'react'
import { COMPANY_STATUSES, type Collaborator, type Company, type CompanyStatus, type Profile } from '../../types'
import { isCompanyStatus } from '../../lib/companies'
import { statusLabel } from '../../lib/labels'
import { useBulkAssignCompanies, useBulkSetCompanyStatus, useDeleteCompanies } from '../../hooks/useCompanies'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Input'

export type BulkAction = 'assign' | 'status' | 'delete'

type CompanyBulkDialogsProps = {
  action: BulkAction | null
  companies: Company[]
  people: Collaborator[]
  profile: Profile
  selectedIds: string[]
  onClose: () => void
  onDone: () => void
}

export function CompanyBulkDialogs({
  action,
  companies,
  people,
  profile,
  selectedIds,
  onClose,
  onDone,
}: CompanyBulkDialogsProps) {
  const [assigneeId, setAssigneeId] = useState('')
  const [status, setStatus] = useState<CompanyStatus>('da_chiamare')
  const assign = useBulkAssignCompanies(profile)
  const setStatuses = useBulkSetCompanyStatus(profile)
  const remove = useDeleteCompanies(profile)
  const selected = companies.filter((company) => selectedIds.includes(company.id))
  const activePeople = people.filter((person) => person.active && person.role === 'collaboratore')
  const preview = selected.slice(0, 5).map((company) => company.name)
  const extra = selected.length - preview.length

  const close = () => {
    setAssigneeId('')
    setStatus('da_chiamare')
    onClose()
  }

  return (
    <>
      <Modal
        open={action === 'assign'}
        title="Assegna aziende"
        description={`${selected.length} aziende selezionate.`}
        onClose={close}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Annulla
            </Button>
            <Button
              loading={assign.isPending}
              onClick={() =>
                assign.mutate(
                  { ids: selectedIds, assigneeId: assigneeId || null },
                  { onSuccess: () => { close(); onDone() } },
                )
              }
            >
              Assegna
            </Button>
          </>
        }
      >
        <Select label="Collaboratore" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
          <option value="">Non assegnata</option>
          {activePeople.map((person) => (
            <option key={person.id} value={person.id}>
              {person.full_name}
            </option>
          ))}
        </Select>
      </Modal>
      <Modal
        open={action === 'status'}
        title="Cambia stato"
        description={`${selected.length} aziende selezionate.`}
        onClose={close}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Annulla
            </Button>
            <Button
              loading={setStatuses.isPending}
              onClick={() =>
                setStatuses.mutate(
                  { ids: selectedIds, status },
                  { onSuccess: () => { close(); onDone() } },
                )
              }
            >
              Aggiorna stato
            </Button>
          </>
        }
      >
        <Select
          label="Nuovo stato"
          value={status}
          onChange={(event) => {
            const value = event.target.value
            if (isCompanyStatus(value)) setStatus(value)
          }}
        >
          {COMPANY_STATUSES.filter((item) => item !== 'da_richiamare').map((item) => (
            <option key={item} value={item}>
              {statusLabel(item)}
            </option>
          ))}
        </Select>
      </Modal>
      <Modal
        open={action === 'delete'}
        title="Elimina aziende"
        description="Le note collegate verranno eliminate. L’operazione non si può annullare."
        onClose={close}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Annulla
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(selectedIds, {
                  onSuccess: () => {
                    close()
                    onDone()
                  },
                })
              }
            >
              Elimina
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          {preview.join(', ')}
          {extra > 0 ? ` e altre ${extra}` : ''}.
        </p>
      </Modal>
    </>
  )
}
