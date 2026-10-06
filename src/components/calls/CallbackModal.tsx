import { useState } from 'react'
import { callbackIso } from '../../lib/calls'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'

type CallbackModalProps = {
  open: boolean
  companyName: string
  pending: boolean
  onClose: () => void
  onConfirm: (callbackAt: string) => void
}

export function CallbackModal({ open, companyName, pending, onClose, onConfirm }: CallbackModalProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const close = () => {
    setValue('')
    setError('')
    onClose()
  }

  return (
    <Modal
      open={open}
      title="Da richiamare"
      description={companyName}
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Annulla
          </Button>
          <Button
            loading={pending}
            onClick={() => {
              const iso = callbackIso(value)
              if (!iso || new Date(iso).getTime() <= Date.now()) {
                setError('Scegli una data e un orario futuri')
                return
              }
              onConfirm(iso)
              setValue('')
              setError('')
            }}
          >
            Conferma richiamo
          </Button>
        </>
      }
    >
      <Input
        label="Data e ora"
        type="datetime-local"
        value={value}
        error={error}
        onChange={(event) => {
          setValue(event.target.value)
          setError('')
        }}
      />
    </Modal>
  )
}
