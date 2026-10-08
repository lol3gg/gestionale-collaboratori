import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { isCallbackOverdue } from '../../lib/callbacks'
import { attemptsToday, companyCallHistory, latestUndoableLog } from '../../lib/calls'
import { websiteHref, websiteLabel } from '../../lib/companies'
import { formatDateTime } from '../../lib/format'
import { statusLabel } from '../../lib/labels'
import { telHref } from '../../lib/phone'
import type { CallLog, Collaborator, Company, CompanyStatus, Profile } from '../../types'
import { CompanyStatusBadge } from '../companies/CompanyStatusBadge'
import { companyAssigneeLabel } from '../companies/CompanyTable'
import { Button } from '../ui/Button'
import { Drawer } from '../ui/Drawer'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Input'
import { CompanyContactActions } from './CompanyContactActions'
import { CLAIM_LIMIT } from '../../lib/api'
import { outcomeButtonClass, statusEdgeClass } from '../../lib/statusColors'

const OUTCOMES: { outcome: CompanyStatus; label: string }[] = [
  { outcome: 'non_risponde', label: 'Non risponde' },
  { outcome: 'accettato', label: 'Accettato' },
  { outcome: 'rifiutato', label: 'Rifiutato' },
  { outcome: 'numero_errato', label: 'Numero errato' },
]

type CallCardProps = {
  company: Company
  logs: CallLog[]
  people: Collaborator[]
  profile: Profile
  note: string
  busy: boolean
  mode?: 'admin' | 'collaborator'
  claimedCount?: number
  claimLimit?: number
  onNote: (value: string) => void
  onOutcome: (outcome: CompanyStatus) => void | Promise<unknown>
  onCallback: () => void
  onClaim?: () => void
  onAssign?: (assigneeId: string) => void
  onRelease?: () => void
  onUndo?: (logId: string) => void
}

export function CallCard({
  company,
  logs,
  people,
  profile,
  note,
  busy,
  mode = 'admin',
  claimedCount = 0,
  claimLimit = CLAIM_LIMIT,
  onNote,
  onOutcome,
  onCallback,
  onClaim,
  onAssign,
  onRelease,
  onUndo,
}: CallCardProps) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [acceptOpen, setAcceptOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const attempts = attemptsToday(company.id, logs)
  const site = websiteHref(company.website)
  const isAdmin = mode === 'admin'
  const phoneLink = telHref(company.phone)
  const history = companyCallHistory(company.id, logs)
  const undoable = latestUndoableLog(company.id, logs, profile.id, isAdmin)
  const activePeople = people.filter((person) => person.active && person.role === 'collaboratore')
  const current = people.find((person) => person.id === company.assignee_id) ?? null
  const options =
    current && !activePeople.some((person) => person.id === current.id) ? [...activePeople, current] : activePeople

  const handleOutcome = (outcome: CompanyStatus) => {
    if (outcome === 'accettato') {
      setMenuOpen(false)
      setAcceptOpen(true)
      return
    }
    onOutcome(outcome)
  }

  const confirmAccept = () => {
    void (async () => {
      try {
        await onOutcome('accettato')
        setAcceptOpen(false)
        setDetailOpen(false)
        setMenuOpen(false)
        void navigate(`/calendario?companyId=${encodeURIComponent(company.id)}`)
      } catch {
        // Resta sulla pagina: l'errore è già mostrato dal toast della mutation
      }
    })()
  }

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  if (!isAdmin) {
    const outcomeActions = [
      ...OUTCOMES.map((item) => ({
        key: item.outcome,
        label: item.label,
        onClick: () => handleOutcome(item.outcome),
      })),
      { key: 'da_richiamare', label: 'Da richiamare', onClick: onCallback },
    ]
    const overdue = isCallbackOverdue(company.callback_at)
    const lastNote = company.notes[0] ?? null
    const inPool = company.assignee_id === null
    const mine = company.assignee_id === profile.id
    const canRelease = mine && history.length === 0 && Boolean(onRelease)
    const atClaimLimit = claimedCount >= claimLimit
    const canClaim = inPool && Boolean(onClaim)

    return (
      <>
        <article
          className={`rounded-xl border bg-surface p-3 shadow-card md:p-3.5 ${statusEdgeClass[company.status]} ${
            overdue ? 'border-danger-dot/50' : 'border-line'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-semibold tracking-tight text-ink md:text-base">
                {company.name}
              </h2>
              <p className="mt-0.5 truncate text-[13px] text-muted">
                {company.city} ({company.province})
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <CompanyStatusBadge status={company.status} />
              {overdue ? (
                <span className="rounded-full bg-danger-bg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-danger-fg">
                  In ritardo
                </span>
              ) : null}
            </div>
          </div>

          {company.phone ? (
            <p className="mt-2 truncate text-[15px] font-semibold tabular-nums text-ink md:text-base">
              {company.phone}
            </p>
          ) : (
            <p className="mt-2 text-[13px] text-muted">Nessun telefono</p>
          )}

          {lastNote ? (
            <p className="mt-2 line-clamp-2 rounded-lg bg-canvas px-2.5 py-1.5 text-[13px] text-ink">
              <span className="font-semibold text-muted">Nota · </span>
              {lastNote.body}
            </p>
          ) : null}

          {attempts > 0 ? (
            <p className="mt-1 text-xs font-medium text-muted">Tentativo n. {attempts}</p>
          ) : null}

          <Button
            variant="secondary"
            className="mt-2.5 min-h-10 w-full border border-line text-sm font-semibold"
            onClick={() => setDetailOpen(true)}
          >
            Mostra
          </Button>
        </article>

        <Drawer
          open={detailOpen}
          title={company.name}
          description={`${company.city} (${company.province}) · ${company.region}`}
          onClose={() => {
            setMenuOpen(false)
            setHistoryOpen(false)
            setDetailOpen(false)
          }}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <CompanyStatusBadge status={company.status} />
              {overdue ? (
                <span className="rounded-full bg-danger-bg px-2.5 py-1 text-xs font-semibold text-danger-fg">
                  In ritardo
                </span>
              ) : null}
              {attempts > 0 ? (
                <span className="rounded-full bg-quiet-bg px-2.5 py-1 text-xs font-semibold text-quiet-fg">
                  Tentativo n. {attempts}
                </span>
              ) : null}
              {inPool ? (
                <span className="rounded-full bg-quiet-bg px-2.5 py-1 text-xs font-medium text-quiet-fg">Nel pool</span>
              ) : mine ? (
                <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
                  Assegnata a te
                </span>
              ) : null}
            </div>

            <dl className="grid gap-3 text-[15px]">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">Dipendenti</dt>
                <dd className="mt-1 tabular-nums text-ink">{company.employees ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">Indirizzo</dt>
                <dd className="mt-1 text-ink">{company.address || '—'}</dd>
              </div>
              {company.callback_at ? (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">Richiamo</dt>
                  <dd className={`mt-1 ${overdue ? 'font-semibold text-danger-fg' : 'text-ink'}`}>
                    {formatDateTime(company.callback_at)}
                  </dd>
                </div>
              ) : null}
            </dl>

            <CompanyContactActions phone={company.phone} email={company.email} website={company.website} />

            {canClaim ? (
              <div>
                <Button
                  className="min-h-12 w-full"
                  disabled={busy || atClaimLimit}
                  onClick={() => onClaim?.()}
                >
                  Prendi in carico
                </Button>
                {atClaimLimit ? (
                  <p className="mt-1.5 text-sm text-muted">
                    Hai raggiunto il limite di {claimLimit} aziende in carico. Rilascia o chiudi alcune schede
                    prima di prenderne altre.
                  </p>
                ) : null}
              </div>
            ) : null}

            {canRelease ? (
              <Button variant="secondary" className="min-h-11 w-full border border-line" disabled={busy} onClick={() => onRelease?.()}>
                Rilascia nel pool
              </Button>
            ) : null}

            {lastNote ? (
              <div className="rounded-xl bg-primary-50/70 px-3 py-2.5 dark:bg-primary-100/40">
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-primary-700">Ultima nota</p>
                <p className="mt-1 text-[15px] text-ink">{lastNote.body}</p>
                <p className="mt-1 text-xs text-muted">
                  {lastNote.author_name} · {formatDateTime(lastNote.created_at)}
                </p>
              </div>
            ) : null}

            <div>
              <label className="block text-sm font-medium text-ink" htmlFor={`nota-${company.id}`}>
                Nota (facoltativa)
              </label>
              <textarea
                id={`nota-${company.id}`}
                value={note}
                rows={3}
                maxLength={2000}
                disabled={busy}
                placeholder="Nota prima dell’esito"
                className="mt-1.5 w-full min-h-11 rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-ink shadow-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:bg-canvas"
                onChange={(event) => onNote(event.target.value)}
              />
            </div>

            <div className="relative" ref={menuRef}>
              <Button
                variant="secondary"
                className="min-h-12 w-full justify-between border border-line px-4 text-[15px] font-semibold shadow-sm"
                disabled={busy}
                aria-expanded={menuOpen}
                aria-controls={menuId}
                onClick={() => setMenuOpen((open) => !open)}
              >
                Registra esito
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted transition-transform duration-150 ${menuOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </Button>
              {menuOpen ? (
                <div
                  id={menuId}
                  role="menu"
                  className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-20 overflow-hidden rounded-xl border border-line bg-surface shadow-card animate-[fade-in_150ms_ease-out]"
                >
                  {outcomeActions.map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      role="menuitem"
                      disabled={busy}
                      className={`flex min-h-12 w-full items-center px-4 text-left text-[15px] font-semibold transition-colors duration-150 hover:bg-canvas disabled:opacity-60 ${
                        action.key === 'accettato'
                          ? 'text-success-fg'
                          : action.key === 'rifiutato'
                            ? 'text-danger-fg'
                            : action.key === 'da_richiamare'
                              ? 'text-violet-fg'
                              : action.key === 'non_risponde'
                                ? 'text-warning-fg'
                                : 'text-ink'
                      }`}
                      onClick={() => {
                        setMenuOpen(false)
                        action.onClick()
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {undoable && onUndo ? (
              <Button variant="ghost" className="min-h-11 w-full" disabled={busy} onClick={() => onUndo(undoable.id)}>
                Annulla ultimo esito
              </Button>
            ) : null}

            <div className="border-t border-line pt-4">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => setHistoryOpen((open) => !open)}
              >
                <h3 className="text-sm font-semibold text-ink">Storico chiamate ({history.length})</h3>
                <ChevronDown
                  className={`h-4 w-4 text-muted transition-transform ${historyOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>
              {historyOpen ? (
                history.length === 0 ? (
                  <p className="mt-2 text-[15px] text-muted">Nessuna chiamata registrata.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {history.map((log) => {
                      const caller = people.find((person) => person.id === log.user_id)
                      return (
                        <li key={log.id} className="rounded-xl bg-canvas px-3 py-2 text-[15px] text-ink">
                          <p className="font-medium text-ink">
                            {statusLabel(log.outcome)}
                            <span className="ml-2 font-normal text-muted">{formatDateTime(log.created_at)}</span>
                          </p>
                          <p className="mt-0.5 text-xs text-muted">
                            {caller?.full_name ?? 'Collaboratore'}
                          </p>
                          {log.note ? <p className="mt-0.5 text-muted">{log.note}</p> : null}
                          {log.callback_at ? (
                            <p className="mt-0.5 text-xs text-muted">Richiamo {formatDateTime(log.callback_at)}</p>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                )
              ) : null}
            </div>
          </div>
        </Drawer>

        <Modal
          open={acceptOpen}
          title="Fissare un appuntamento?"
          description={`Confermi l’accettazione di ${company.name}? Verrai portato al calendario per scegliere data e orario.`}
          onClose={() => setAcceptOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setAcceptOpen(false)}>
                Annulla
              </Button>
              <Button onClick={confirmAccept} disabled={busy}>
                Sì, vai al calendario
              </Button>
            </>
          }
        >
          <p className="text-[15px] text-muted">
            L’esito verrà registrato come Accettato e potrai fissare subito la call di spiegazione.
          </p>
        </Modal>
      </>
    )
  }

  return (
    <>
      <article className={`card-surface p-4 ${statusEdgeClass[company.status]}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="break-words text-base font-semibold tracking-tight text-ink">{company.name}</h2>
            <p className="text-[13px] text-muted">
              {company.city} ({company.province}) · {company.region}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <CompanyStatusBadge status={company.status} />
            {attempts > 0 ? (
              <span className="rounded-full bg-quiet-bg px-2.5 py-1 text-xs font-semibold text-quiet-fg">
                Tentativo n. {attempts}
              </span>
            ) : null}
          </div>
        </div>

        <p className="mt-2 break-words text-lg font-semibold tabular-nums text-ink">{company.phone || '—'}</p>
        {phoneLink ? (
          <a
            href={phoneLink}
            className="btn-primary-solid mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold"
          >
            Chiama
          </a>
        ) : null}

        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-muted">
          {site ? (
            <a href={site} target="_blank" rel="noreferrer" className="text-primary-700 hover:underline">
              {websiteLabel(company.website)}
            </a>
          ) : null}
          <span>Assegnata a {companyAssigneeLabel(company.assignee_id, people)}</span>
          {company.callback_at ? <span>Richiamo {formatDateTime(company.callback_at)}</span> : null}
        </div>

        <label className="mt-3 block text-sm font-medium text-ink" htmlFor={`nota-admin-${company.id}`}>
          Nota (facoltativa)
        </label>
        <textarea
          id={`nota-admin-${company.id}`}
          value={note}
          rows={2}
          maxLength={2000}
          disabled={busy}
          placeholder="Nota prima dell’esito"
          className="mt-1 w-full min-h-11 rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-ink shadow-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:bg-canvas"
          onChange={(event) => onNote(event.target.value)}
        />

        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {OUTCOMES.map((item) => (
            <Button
              key={item.outcome}
              variant="secondary"
              className={`w-full sm:w-auto ${outcomeButtonClass(item.outcome)}`}
              disabled={busy}
              onClick={() => handleOutcome(item.outcome)}
            >
              {item.label}
            </Button>
          ))}
          <Button
            variant="secondary"
            className={`col-span-2 w-full sm:w-auto ${outcomeButtonClass('da_richiamare')}`}
            disabled={busy}
            onClick={onCallback}
          >
            Da richiamare
          </Button>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Select
              label="Riassegna"
              value={company.assignee_id ?? ''}
              disabled={busy || !onAssign}
              onChange={(event) => {
                const value = event.target.value
                if (value && value !== company.assignee_id) onAssign?.(value)
              }}
            >
              <option value="">Nel pool</option>
              {options.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.active ? person.full_name : `${person.full_name} (disattivo)`}
                </option>
              ))}
            </Select>
          </div>
          {company.assignee_id ? (
            <Button variant="secondary" className="min-h-11" disabled={busy || !onRelease} onClick={() => onRelease?.()}>
              Libera
            </Button>
          ) : null}
        </div>
      </article>

      <Modal
        open={acceptOpen}
        title="Fissare un appuntamento?"
        description={`Confermi l’accettazione di ${company.name}? Verrai portato al calendario per scegliere data e orario.`}
        onClose={() => setAcceptOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAcceptOpen(false)}>
              Annulla
            </Button>
            <Button onClick={confirmAccept} disabled={busy}>
              Sì, vai al calendario
            </Button>
          </>
        }
      >
        <p className="text-[15px] text-muted">
          L’esito verrà registrato come Accettato e potrai fissare subito la call di spiegazione.
        </p>
      </Modal>
    </>
  )
}
