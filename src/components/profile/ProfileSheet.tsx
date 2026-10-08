import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { changePassword } from '../../lib/api'
import { roleLabel } from '../../lib/labels'
import { errorMessage, mapAuthError, validatePassword } from '../../lib/validators'
import type { Profile } from '../../types'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { useToast } from '../ui/Toast'

type ProfileSheetProps = {
  open: boolean
  profile: Profile
  onClose: () => void
}

export function ProfileSheet({ open, profile, onClose }: ProfileSheetProps) {
  const toast = useToast()
  const navigate = useNavigate()
  const { realRole, viewingAsCollaborator, setViewAsCollaborator } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const canSwitchRole = realRole === 'admin'

  useEffect(() => {
    if (!open) return
    setCurrentPassword('')
    setNextPassword('')
    setConfirmPassword('')
    setError(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    const pwdError = validatePassword(nextPassword)
    if (pwdError) {
      setError(pwdError)
      return
    }
    if (nextPassword !== confirmPassword) {
      setError('Le password non coincidono')
      return
    }
    if (!currentPassword) {
      setError('Inserisci la password attuale')
      return
    }
    setSubmitting(true)
    try {
      await changePassword(currentPassword, nextPassword)
      toast.success('Password aggiornata')
      onClose()
    } catch (caught) {
      const message = errorMessage(caught)
      const lower = message.toLowerCase()
      if (
        lower.includes('invalid login') ||
        lower.includes('email o password non corretti') ||
        message === mapAuthError('Invalid login credentials')
      ) {
        setError('Password attuale non corretta')
      } else {
        setError(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[55]">
      <button type="button" className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" aria-label="Chiudi" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Profilo"
        className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-[1.25rem] bg-surface pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lift animate-[sheet-up_180ms_ease-out] md:inset-auto md:right-6 md:top-20 md:bottom-auto md:max-h-[min(90vh,40rem)] md:w-full md:max-w-md md:rounded-2xl md:animate-[fade-in_150ms_ease-out]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-5 py-4">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Profilo</h2>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-canvas text-ink"
            aria-label="Chiudi"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <dl className="space-y-3 text-[15px]">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">Nome</dt>
              <dd className="mt-1 font-medium text-ink">{profile.full_name || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">Email</dt>
              <dd className="mt-1 break-all text-ink">{profile.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">Ruolo</dt>
              <dd className="mt-1 text-ink">
                {roleLabel(profile.role)}
                {viewingAsCollaborator ? ' (anteprima)' : ''}
              </dd>
            </div>
          </dl>

          {canSwitchRole ? (
            <div className="border-t border-line pt-5">
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => {
                  if (viewingAsCollaborator) {
                    setViewAsCollaborator(false)
                    onClose()
                    navigate('/dashboard', { replace: true })
                  } else {
                    setViewAsCollaborator(true)
                    onClose()
                    navigate('/le-mie-aziende', { replace: true })
                  }
                }}
              >
                {viewingAsCollaborator ? 'Torna alla vista admin' : 'Passa alla vista collaboratore'}
              </Button>
            </div>
          ) : null}

          <form className="space-y-3 border-t border-line pt-5" onSubmit={(event) => void submit(event)} noValidate>
            <h3 className="text-sm font-semibold text-ink">Cambia password</h3>
            {error ? (
              <p className="rounded-xl bg-danger-bg px-3 py-2.5 text-[15px] text-danger-fg" role="alert">
                {error}
              </p>
            ) : null}
            <Input
              label="Password attuale"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
            <Input
              label="Nuova password"
              type="password"
              autoComplete="new-password"
              value={nextPassword}
              onChange={(event) => setNextPassword(event.target.value)}
            />
            <Input
              label="Conferma nuova password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            <Button type="submit" className="w-full" loading={submitting}>
              Aggiorna password
            </Button>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  )
}
