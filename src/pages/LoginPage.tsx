import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { DevologyLogo } from '../components/brand/DevologyLogo'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { FullPageSpinner } from '../components/ui/Spinner'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { useProfile } from '../hooks/useProfile'
import { isDemoMode } from '../lib/demo'
import { consumeAuthNotice } from '../lib/format'
import { errorMessage } from '../lib/validators'
import type { UserRole } from '../types'

export function LoginPage() {
  if (isDemoMode) return <DemoLoginPage />
  return <RealLoginPage />
}

function DemoLoginPage() {
  const { profile, loading } = useProfile()
  const { enterAs } = useAuth()
  const [error, setError] = useState<string | null>(() => consumeAuthNotice())

  if (loading) return <FullPageSpinner />
  if (profile) return <Navigate to="/dashboard" replace />

  const choose = (role: UserRole) => {
    const message = enterAs(role)
    setError(message)
  }

  return (
    <div className="login-shell flex min-h-screen items-center justify-center px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 sm:right-6">
        <ThemeToggle compact className="min-h-10 w-10 px-0" />
      </div>
      <div className="page-enter relative z-10 w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mb-5 flex justify-center">
            <DevologyLogo markClassName="h-14 w-14" showWordmark={false} />
          </div>
          <p className="text-sm font-semibold tracking-tight text-muted">Devology System</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-[2.15rem]">
            Gestione <span className="brand-gradient-text">Collaboratori</span>
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Scegli con quale ruolo entrare. I dati sono di esempio.
          </p>
          <span className="mt-4 inline-flex items-center rounded-full bg-warning-bg px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-warning-fg">
            Demo
          </span>
        </div>
        {error ? (
          <p className="mb-4 rounded-xl bg-danger-bg px-3 py-2.5 text-center text-[15px] text-danger-fg" role="alert">
            {error}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          <button
            type="button"
            onClick={() => choose('admin')}
            className="card-surface px-5 py-7 text-left transition duration-200 hover:-translate-y-0.5 hover:border-primary-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:py-9"
          >
            <span className="block text-lg font-semibold tracking-tight text-ink">Entra come Admin</span>
            <span className="mt-2 block text-[15px] text-muted">Lillo (Admin)</span>
          </button>
          <button
            type="button"
            onClick={() => choose('collaboratore')}
            className="card-surface px-5 py-7 text-left transition duration-200 hover:-translate-y-0.5 hover:border-primary-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:py-9"
            style={{ animationDelay: '60ms' }}
          >
            <span className="block text-lg font-semibold tracking-tight text-ink">Entra come Collaboratore</span>
            <span className="mt-2 block text-[15px] text-muted">Marco Rossi</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function RealLoginPage() {
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
          <Input label="Email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input label="Password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <Button type="submit" className="w-full" loading={submitting}>
            Accedi
          </Button>
        </form>
      </div>
    </div>
  )
}
