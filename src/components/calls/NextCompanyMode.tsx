import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useToast } from '../ui/Toast'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { CompanyContactActions } from './CompanyContactActions'
import { CallbackModal } from './CallbackModal'
import { getCallLogs, getNextCompany } from '../../lib/api'
import { attemptsToday, companyCallHistory } from '../../lib/calls'
import { isCallbackOverdue } from '../../lib/callbacks'
import { formatDateTime } from '../../lib/format'
import { statusLabel } from '../../lib/labels'
import { errorMessage } from '../../lib/validators'
import { CompanyStatusBadge } from '../companies/CompanyStatusBadge'
import type { CallLog, Company, CompanyStatus, Profile } from '../../types'
import { useRecordCall, useUndoCall } from '../../hooks/useCalls'
import { outcomeButtonClass, statusEdgeClass } from '../../lib/statusColors'

const OUTCOMES: { outcome: CompanyStatus; label: string }[] = [
  { outcome: 'non_risponde', label: 'Non risponde' },
  { outcome: 'accettato', label: 'Accettato' },
  { outcome: 'rifiutato', label: 'Rifiutato' },
  { outcome: 'numero_errato', label: 'Numero errato' },
]

type NextCompanyModeProps = {
  open: boolean
  profile: Profile
  onClose: () => void
}

export function NextCompanyMode({ open, profile, onClose }: NextCompanyModeProps) {
  const toast = useToast()
  const navigate = useNavigate()
  const record = useRecordCall(profile)
  const undo = useUndoCall(profile)
  const [company, setCompany] = useState<Company | null>(null)
  const [logs, setLogs] = useState<CallLog[]>([])
  const [skipIds, setSkipIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState('')
  const [callbackOpen, setCallbackOpen] = useState(false)
  const [empty, setEmpty] = useState(false)

  const loadNext = useCallback(
    async (skips: string[]) => {
      setLoading(true)
      setEmpty(false)
      try {
        const next = await getNextCompany(skips)
        if (!next) {
          setCompany(null)
          setLogs([])
          setEmpty(true)
          return
        }
        setCompany(next)
        setNote('')
        const history = await getCallLogs(next.id, {
          id: profile.id,
          full_name: profile.full_name,
          role: profile.role,
        })
        setLogs(history)
      } catch (error) {
        toast.error(errorMessage(error))
      } finally {
        setLoading(false)
      }
    },
    [profile, toast],
  )

  useEffect(() => {
    if (!open) return
    setSkipIds([])
    void loadNext([])
  }, [open, loadNext])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const history = company ? companyCallHistory(company.id, logs) : []
  const lastNote = company?.notes[0] ?? null
  const overdue = company ? isCallbackOverdue(company.callback_at) : false
  const attempts = company ? attemptsToday(company.id, logs) : 0
  const busy = record.isPending || undo.isPending

  const saveOutcome = async (outcome: CompanyStatus, callbackAt: string | null) => {
    if (!company) return
    try {
      const result = await record.mutateAsync({
        companyId: company.id,
        outcome,
        note: note.trim() || null,
        callbackAt,
      })
      toast.success('Esito registrato', {
        label: 'Annulla',
        onClick: () => undo.mutate(result.log.id),
      })
      if (outcome === 'accettato') {
        onClose()
        void navigate(`/calendario?companyId=${encodeURIComponent(company.id)}`)
        return
      }
      setCallbackOpen(false)
      await loadNext(skipIds)
    } catch {
      // toast già gestito
    }
  }

  const skip = () => {
    if (!company) return
    const nextSkips = [...skipIds, company.id]
    setSkipIds(nextSkips)
    void loadNext(nextSkips)
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-canvas">
      <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Prossima azienda</p>
          <p className="text-sm text-muted">Priorità: richiami → riprovare → pool</p>
        </div>
        <button
          type="button"
          aria-label="Chiudi"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-canvas text-ink"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {loading && !company ? (
          <div className="flex justify-center py-24">
            <Spinner className="h-8 w-8 text-primary-600" />
          </div>
        ) : null}

        {empty ? (
          <div className="mx-auto max-w-md py-16 text-center">
            <p className="text-lg font-semibold text-ink">Nessuna azienda da chiamare</p>
            <p className="mt-2 text-[15px] text-muted">Hai completato la coda prioritaria.</p>
            <Button className="mt-6" onClick={onClose}>
              Torna alla lista
            </Button>
          </div>
        ) : null}

        {company ? (
          <div className={`mx-auto max-w-lg space-y-5 rounded-2xl border bg-surface p-4 shadow-card sm:p-6 ${statusEdgeClass[company.status]} ${
            overdue ? 'border-danger-dot/50' : 'border-line'
          }`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{company.name}</h1>
                <p className="mt-1 text-[15px] text-muted">
                  {company.city} ({company.province}) · {company.region}
                </p>
                {company.employees != null ? (
                  <p className="mt-1 text-sm text-muted">{company.employees} dipendenti</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <CompanyStatusBadge status={company.status} />
                {overdue ? (
                  <span className="rounded-full bg-danger-bg px-2.5 py-1 text-xs font-semibold text-danger-fg">
                    In ritardo
                  </span>
                ) : null}
              </div>
            </div>

            <CompanyContactActions
              phone={company.phone}
              email={company.email}
              website={company.website}
              hugeCall
            />

            {lastNote ? (
              <div className="rounded-xl bg-primary-50/70 px-3 py-2.5 dark:bg-primary-100/40">
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-primary-700">Ultima nota</p>
                <p className="mt-1 text-[15px] text-ink">{lastNote.body}</p>
                <p className="mt-1 text-xs text-muted">
                  {lastNote.author_name} · {formatDateTime(lastNote.created_at)}
                </p>
              </div>
            ) : null}

            {attempts > 0 ? (
              <p className="text-sm font-medium text-muted">Tentativo n. {attempts} oggi</p>
            ) : null}

            <div>
              <label className="block text-sm font-medium text-ink" htmlFor="next-note">
                Nota (facoltativa)
              </label>
              <textarea
                id="next-note"
                value={note}
                rows={3}
                maxLength={2000}
                disabled={busy}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {OUTCOMES.map((item) => (
                <Button
                  key={item.outcome}
                  variant="secondary"
                  className={`min-h-12 text-[15px] ${outcomeButtonClass(item.outcome)}`}
                  disabled={busy || loading}
                  onClick={() => void saveOutcome(item.outcome, null)}
                >
                  {item.label}
                </Button>
              ))}
              <Button
                variant="secondary"
                className={`min-h-12 col-span-2 text-[15px] ${outcomeButtonClass('da_richiamare')}`}
                disabled={busy || loading}
                onClick={() => setCallbackOpen(true)}
              >
                Da richiamare
              </Button>
            </div>

            <Button variant="ghost" className="min-h-11 w-full" disabled={busy || loading} onClick={skip}>
              Salta (rimanda in fondo)
            </Button>

            <div className="border-t border-line pt-4">
              <h2 className="text-sm font-semibold text-ink">Storico</h2>
              {history.length === 0 ? (
                <p className="mt-1 text-[15px] text-muted">Nessuna chiamata registrata.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {history.map((log) => (
                    <li key={log.id} className="rounded-xl bg-canvas px-3 py-2 text-[15px]">
                      <p className="font-medium text-ink">
                        {statusLabel(log.outcome)}
                        <span className="ml-2 font-normal text-muted">{formatDateTime(log.created_at)}</span>
                      </p>
                      {log.note ? <p className="mt-0.5 text-muted">{log.note}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <CallbackModal
        open={callbackOpen}
        companyName={company?.name ?? ''}
        pending={record.isPending}
        onClose={() => setCallbackOpen(false)}
        onConfirm={(callbackAt) => void saveOutcome('da_richiamare', callbackAt)}
      />
    </div>,
    document.body,
  )
}
