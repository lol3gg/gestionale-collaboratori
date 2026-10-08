import { useEffect, useState, type FormEvent } from 'react'
import { useProfile } from '../../hooks/useProfile'
import {
  useCreateCollaborator,
  useSetCollaboratorActive,
  useUpdateCollaborator,
} from '../../hooks/useCollaborators'
import type { FieldErrors } from '../../lib/validators'
import { validateEmail, validateFullName, validatePassword, validateRole } from '../../lib/validators'
import type { Collaborator, UserRole } from '../../types'
import { Button } from '../ui/Button'
import { Input, Select } from '../ui/Input'
import { Modal } from '../ui/Modal'

function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0
}

export function CreateCollaboratorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateCollaborator()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('collaboratore')
  const [errors, setErrors] = useState<FieldErrors>({})

  useEffect(() => {
    if (!open) return
    setFullName('')
    setEmail('')
    setPassword('')
    setRole('collaboratore')
    setErrors({})
  }, [open])

  const requestClose = () => {
    if (create.isPending) return
    onClose()
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const nextErrors: FieldErrors = {}
    const nameError = validateFullName(fullName)
    const emailError = validateEmail(email)
    const passwordError = validatePassword(password)
    const nextRole = validateRole(role)
    if (nameError) nextErrors.full_name = nameError
    if (emailError) nextErrors.email = emailError
    if (passwordError) nextErrors.password = passwordError
    if (!nextRole) nextErrors.role = 'Seleziona un ruolo valido'
    setErrors(nextErrors)
    if (hasErrors(nextErrors) || !nextRole) return

    try {
      await create.mutateAsync({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role: nextRole,
      })
      onClose()
    } catch {
      // Il toast di errore è gestito dalla mutation.
    }
  }

  return (
    <Modal
      open={open}
      title="Nuovo collaboratore"
      onClose={requestClose}
      footer={
        <>
          <Button variant="secondary" onClick={requestClose} disabled={create.isPending}>
            Annulla
          </Button>
          <Button type="submit" form="create-collaborator" loading={create.isPending}>
            Crea
          </Button>
        </>
      }
    >
      <form id="create-collaborator" className="space-y-4" onSubmit={(event) => void submit(event)} noValidate>
        <Input label="Nome completo" value={fullName} onChange={(event) => setFullName(event.target.value)} error={errors.full_name} autoComplete="name" />
        <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} error={errors.email} autoComplete="off" />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          autoComplete="new-password"
        />
        <Select label="Ruolo" value={role} onChange={(event) => setRole(event.target.value === 'admin' ? 'admin' : 'collaboratore')} error={errors.role}>
          <option value="collaboratore">Collaboratore</option>
          <option value="admin">Amministratore</option>
        </Select>
      </form>
    </Modal>
  )
}

export function EditCollaboratorModal({
  collaborator,
  self,
  onClose,
}: {
  collaborator: Collaborator | null
  self: boolean
  onClose: () => void
}) {
  const { profile } = useProfile()
  const update = useUpdateCollaborator()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('collaboratore')
  const [dailyGoal, setDailyGoal] = useState('30')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [goalError, setGoalError] = useState<string | null>(null)

  useEffect(() => {
    if (!collaborator) return
    setFullName(collaborator.full_name)
    setEmail(collaborator.email)
    setRole(collaborator.role)
    setDailyGoal(String(collaborator.daily_goal ?? 30))
    setErrors({})
    setGoalError(null)
  }, [collaborator])

  const requestClose = () => {
    if (update.isPending) return
    onClose()
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!collaborator || !profile) return
    const nextErrors: FieldErrors = {}
    const nameError = validateFullName(fullName)
    const emailError = validateEmail(email)
    const nextRole = self ? collaborator.role : validateRole(role)
    const goalNum = Number(dailyGoal)
    let nextGoalError: string | null = null
    if (!Number.isInteger(goalNum) || goalNum < 1 || goalNum > 500) {
      nextGoalError = 'Inserisci un obiettivo tra 1 e 500'
    }
    if (nameError) nextErrors.full_name = nameError
    if (emailError) nextErrors.email = emailError
    if (!nextRole) nextErrors.role = 'Seleziona un ruolo valido'
    setErrors(nextErrors)
    setGoalError(nextGoalError)
    if (hasErrors(nextErrors) || !nextRole || nextGoalError) return

    try {
      await update.mutateAsync({
        user_id: collaborator.id,
        actor_id: profile.id,
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        role: nextRole,
        daily_goal: goalNum,
      })
      onClose()
    } catch {
      // Il toast di errore è gestito dalla mutation.
    }
  }

  return (
    <Modal
      open={collaborator !== null}
      title="Modifica collaboratore"
      onClose={requestClose}
      footer={
        <>
          <Button variant="secondary" onClick={requestClose} disabled={update.isPending}>
            Annulla
          </Button>
          <Button type="submit" form="edit-collaborator" loading={update.isPending}>
            Salva
          </Button>
        </>
      }
    >
      <form id="edit-collaborator" className="space-y-4" onSubmit={(event) => void submit(event)} noValidate>
        <Input label="Nome completo" value={fullName} onChange={(event) => setFullName(event.target.value)} error={errors.full_name} />
        <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} error={errors.email} />
        <Select
          label="Ruolo"
          value={role}
          disabled={self}
          hint={self ? 'Non puoi modificare il tuo ruolo' : undefined}
          error={errors.role}
          onChange={(event) => setRole(event.target.value === 'admin' ? 'admin' : 'collaboratore')}
        >
          <option value="collaboratore">Collaboratore</option>
          <option value="admin">Amministratore</option>
        </Select>
        <Input
          label="Obiettivo chiamate / giorno"
          type="number"
          min={1}
          max={500}
          value={dailyGoal}
          onChange={(event) => setDailyGoal(event.target.value)}
          error={goalError ?? undefined}
        />
      </form>
    </Modal>
  )
}

export function ActiveCollaboratorModal({
  collaborator,
  onClose,
}: {
  collaborator: Collaborator | null
  onClose: () => void
}) {
  const { profile } = useProfile()
  const setActive = useSetCollaboratorActive()
  const turningOff = collaborator?.active === true

  const requestClose = () => {
    if (setActive.isPending) return
    onClose()
  }

  const confirm = async () => {
    if (!collaborator || !profile) return
    try {
      await setActive.mutateAsync({
        user_id: collaborator.id,
        active: !collaborator.active,
        actor_id: profile.id,
      })
      onClose()
    } catch {
      // Il toast di errore è gestito dalla mutation.
    }
  }

  return (
    <Modal
      open={collaborator !== null}
      title={turningOff ? 'Disattiva account' : 'Riattiva account'}
      description={
        collaborator
          ? turningOff
            ? `${collaborator.full_name || collaborator.email} non potrà più accedere.`
            : `Ripristina l'accesso per ${collaborator.full_name || collaborator.email}.`
          : undefined
      }
      onClose={requestClose}
      footer={
        <>
          <Button variant="secondary" onClick={requestClose} disabled={setActive.isPending}>
            Annulla
          </Button>
          <Button variant={turningOff ? 'danger' : 'primary'} loading={setActive.isPending} onClick={() => void confirm()}>
            {turningOff ? 'Disattiva' : 'Riattiva'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">
        {turningOff ? 'L’account risulterà disattivo.' : 'L’account tornerà attivo.'}
      </p>
    </Modal>
  )
}
