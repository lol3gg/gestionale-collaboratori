import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { FullPageSpinner } from '../components/ui/Spinner'
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold tracking-wide text-amber-900 ring-1 ring-amber-500/30">
            DEMO
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">Gestione Collaboratori</h1>
          <p className="mt-2 text-sm text-slate-500">Scegli con quale ruolo entrare. I dati sono di esempio.</p>
        </div>
        {error ? (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => choose('admin')}
            className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-left shadow-sm transition hover:border-indigo-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:py-10"
          >
            <span className="block text-lg font-semibold text-slate-900">Entra come Admin</span>
            <span className="mt-2 block text-sm text-slate-500">Lillo (Admin)</span>
          </button>
          <button
            type="button"
            onClick={() => choose('collaboratore')}
            className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-left shadow-sm transition hover:border-indigo-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:py-10"
          >
            <span className="block text-lg font-semibold text-slate-900">Entra come Collaboratore</span>
            <span className="mt-2 block text-sm text-slate-500">Marco Rossi</span>
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-sm font-semibold text-white">
            GC
          </span>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Gestione Collaboratori</h1>
            <p className="text-sm text-slate-500">Accedi al tuo account</p>
          </div>
        </div>
        <form className="space-y-4" onSubmit={(event) => void submit(event)} noValidate>
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
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
