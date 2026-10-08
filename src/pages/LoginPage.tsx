import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { DevologyLogo } from '../components/brand/DevologyLogo'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { FullPageSpinner } from '../components/ui/Spinner'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { useProfile } from '../hooks/useProfile'
import { AUTH_BYPASS } from '../lib/authBypass'
import { consumeAuthNotice } from '../lib/format'
import { errorMessage } from '../lib/validators'

export function LoginPage() {
  const { profile, loading } = useProfile()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(() => consumeAuthNotice())
  const [submitting, setSubmitting] = useState(false)

  if (AUTH_BYPASS) return <Navigate to="/dashboard" replace />
  if (loading) return <FullPageSpinner />
  if (profile) return <Navigate to="/dashboard" replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-shell flex min-h-screen flex-col items-center justify-center px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 sm:right-6">
        <ThemeToggle compact className="min-h-10 w-10 px-0" />
      </div>

      <div className="page-enter relative z-10 flex w-full max-w-md flex-col items-center">
        <DevologyLogo hero showWordmark markClassName="h-[4.75rem] w-[4.75rem] sm:h-[5.25rem] sm:w-[5.25rem]" />
        <p className="mt-3 max-w-sm text-center text-[15px] leading-relaxed text-muted">
          Gestione Collaboratori — chiama, assegna e tieni il ritmo del team.
        </p>

        <div className="card-surface mt-8 w-full p-6 sm:p-8">
          <h1 className="text-lg font-semibold tracking-tight text-ink">Accedi</h1>
          <p className="mt-1 text-[15px] text-muted">Entra con la tua email aziendale</p>

          <form className="mt-5 space-y-4" onSubmit={(event) => void submit(event)} noValidate>
            {error ? (
              <p className="rounded-xl bg-danger-bg px-3 py-2.5 text-[15px] text-danger-fg" role="alert">
                {error}
              </p>
            ) : null}
            <Input
              label="Email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button type="submit" className="w-full" loading={submitting}>
              Accedi
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
