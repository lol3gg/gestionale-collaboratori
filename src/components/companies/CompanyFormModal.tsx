import { useState } from 'react'
import { COMPANY_STATUSES, type Collaborator, type CompanyStatus, type Profile } from '../../types'
import { statusLabel } from '../../lib/labels'
import { callbackIso } from '../../lib/calls'
import { validateCompanyDetails, isCompanyStatus, type CompanyFormErrors, type CompanyFormInput } from '../../lib/companies'
import { useCreateCompany } from '../../hooks/useCompanies'
import { CompanyFields } from './CompanyFields'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Input, Select } from '../ui/Input'

const emptyForm: CompanyFormInput = {
  name: '',
  phone: '',
  email: '',
  website: '',
  address: '',
  city: '',
  province: '',
  region: '',
  employees: '',
}

type CompanyFormModalProps = {
  open: boolean
  profile: Profile
  people: Collaborator[]
  onClose: () => void
}

export function CompanyFormModal({ open, profile, people, onClose }: CompanyFormModalProps) {
  const [form, setForm] = useState<CompanyFormInput>(emptyForm)
  const [status, setStatus] = useState<CompanyStatus>('da_chiamare')
  const [assigneeId, setAssigneeId] = useState('')
  const [callbackAt, setCallbackAt] = useState('')
  const [callbackError, setCallbackError] = useState('')
  const [errors, setErrors] = useState<CompanyFormErrors>({})
  const create = useCreateCompany(profile)
  const activePeople = people.filter((person) => person.active && person.role === 'collaboratore')

  const close = () => {
    setForm(emptyForm)
    setStatus('da_chiamare')
    setAssigneeId('')
    setCallbackAt('')
    setCallbackError('')
    setErrors({})
    onClose()
  }

  return (
    <Modal
      open={open}
      title="Nuova azienda"
      description="I campi email, sito, indirizzo e dipendenti sono facoltativi."
      onClose={close}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Annulla
          </Button>
          <Button
            loading={create.isPending}
            onClick={() => {
              const parsed = validateCompanyDetails(form)
              setErrors(parsed.errors)
              if (!parsed.details) return
              if (status === 'da_richiamare') {
                const iso = callbackIso(callbackAt)
                if (!iso || new Date(iso).getTime() <= Date.now()) {
                  setCallbackError('Scegli una data e un orario futuri')
                  return
                }
                create.mutate(
                  { ...parsed.details, status, assignee_id: assigneeId || null, callback_at: iso },
                  { onSuccess: close },
                )
                return
              }
              create.mutate(
                { ...parsed.details, status, assignee_id: assigneeId || null, callback_at: null },
                { onSuccess: close },
              )
            }}
          >
            Crea azienda
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <CompanyFields
          value={form}
          errors={errors}
          onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Stato"
            value={status}
            onChange={(event) => {
              const value = event.target.value
              if (isCompanyStatus(value)) {
              setStatus(value)
              setCallbackError('')
            }
            }}
          >
            {COMPANY_STATUSES.map((item) => (
              <option key={item} value={item}>
                {statusLabel(item)}
              </option>
            ))}
          </Select>
          <Select label="Assegnata a" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
            <option value="">Non assegnata</option>
            {activePeople.map((person) => (
              <option key={person.id} value={person.id}>
                {person.full_name}
              </option>
            ))}
          </Select>
        </div>
        {status === 'da_richiamare' ? (
          <Input
            label="Data e ora del richiamo"
            type="datetime-local"
            value={callbackAt}
            error={callbackError}
            onChange={(event) => {
              setCallbackAt(event.target.value)
              setCallbackError('')
            }}
          />
        ) : null}
      </div>
    </Modal>
  )
}
