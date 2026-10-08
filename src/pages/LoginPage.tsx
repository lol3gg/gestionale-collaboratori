import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { DevologyLogo } from '../components/brand/DevologyLogo'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { FullPageSpinner } from '../components/ui/Spinner'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { useProfile } from '../hooks/useProfile'
import { consumeAuthNotice } from '../lib/format'
import { errorMessage } from '../lib/validators'

export function LoginPage() {
  const { profile, loading } = useProfile()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(() => consumeAuthNotice())
  const [submitting, setSubmitting] = useState(false)

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
    <div className="login-shell flex min-h-screen items-center justify-center px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 sm:right-6">
        <ThemeToggle compact className="min-h-10 w-10 px-0" />
      </div>
      <div className="page-enter relative z-10 card-surface w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <DevologyLogo markClassName="h-11 w-11" showWordmark={false} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Devology</p>
            <h1 className="text-lg font-semibold tracking-tight text-ink">Gestione Collaboratori</h1>
            <p className="text-[15px] text-muted">Accedi al tuo account</p>
          </div>
        </div>
        <form className="space-y-4" onSubmit={(event) => void submit(event)} noValidate>
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
  )
}
