import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Phone } from 'lucide-react'
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
  onNote: (value: string) => void
  onOutcome: (outcome: CompanyStatus) => void
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
  onNote,
  onOutcome,
  onCallback,
  onAssign,
  onRelease,
  onUndo,
}: CallCardProps) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [acceptOpen, setAcceptOpen] = useState(false)
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
    setAcceptOpen(false)
    setDetailOpen(false)
    setMenuOpen(false)
    onOutcome('accettato')
    void navigate(`/calendario?companyId=${encodeURIComponent(company.id)}`)
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

    return (
      <>
        <article className="rounded-xl border border-line bg-surface p-3 shadow-card ring-1 ring-slate-900/[0.03] md:p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-semibold tracking-tight text-ink md:text-base">
                {company.name}
              </h2>
              <p className="mt-0.5 truncate text-[13px] text-muted">
                {company.city} ({company.province})
              </p>
            </div>
            <CompanyStatusBadge status={company.status} />
          </div>

          {company.phone ? (
            <p className="mt-2 truncate text-[15px] font-semibold tabular-nums text-emerald-600 md:text-base">
              {company.phone}
            </p>
          ) : (
            <p className="mt-2 text-[13px] text-muted">Nessun telefono</p>
          )}

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
            setDetailOpen(false)
          }}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <CompanyStatusBadge status={company.status} />
              {attempts > 0 ? (
                <span className="rounded-full bg-quiet-bg px-2.5 py-1 text-xs font-semibold text-quiet-fg">
                  Tentativo n. {attempts}
                </span>
              ) : null}
              {company.assignee_id === null ? (
                <span className="rounded-full bg-quiet-bg px-2.5 py-1 text-xs font-medium text-quiet-fg">Nel pool</span>
              ) : (
                <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
                  Assegnata a te
                </span>
              )}
            </div>

            <dl className="grid gap-3 text-[15px]">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">Telefono</dt>
                <dd className="mt-1">
                  {company.phone ? (
                    <span className="font-semibold tabular-nums text-emerald-600">{company.phone}</span>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">Email</dt>
                <dd className="mt-1 break-all text-ink">
                  {company.email ? (
                    <a href={`mailto:${company.email}`} className="text-primary-700 hover:underline">
                      {company.email}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">Sito</dt>
                <dd className="mt-1 break-all text-ink">
                  {site ? (
                    <a href={site} target="_blank" rel="noreferrer" className="text-primary-700 hover:underline">
                      {websiteLabel(company.website)}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">Indirizzo</dt>
                <dd className="mt-1 text-ink">{company.address || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">Dipendenti</dt>
                <dd className="mt-1 tabular-nums text-ink">{company.employees ?? '—'}</dd>
              </div>
              {company.callback_at ? (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">Richiamo</dt>
                  <dd className="mt-1 text-ink">{formatDateTime(company.callback_at)}</dd>
                </div>
              ) : null}
            </dl>

            {phoneLink ? (
              <a
                href={phoneLink}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-base font-semibold tracking-tight text-white shadow-sm transition duration-150 hover:bg-emerald-700 active:scale-[0.98]"
              >
                <Phone className="h-5 w-5" aria-hidden="true" />
                Chiama {company.phone}
              </a>
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
                      className="flex min-h-12 w-full items-center px-4 text-left text-[15px] font-medium text-ink transition-colors duration-150 hover:bg-canvas disabled:opacity-60"
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
              <h3 className="text-sm font-semibold text-ink">Storico chiamate</h3>
              {history.length === 0 ? (
                <p className="mt-1 text-[15px] text-muted">Nessuna chiamata registrata.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {history.map((log) => (
                    <li key={log.id} className="rounded-xl bg-canvas px-3 py-2 text-[15px] text-ink">
                      <p className="font-medium text-ink">
                        {statusLabel(log.outcome)}
                        <span className="ml-2 font-normal text-muted">{formatDateTime(log.created_at)}</span>
                      </p>
                      {log.note ? <p className="mt-0.5 text-muted">{log.note}</p> : null}
                      {log.callback_at ? (
                        <p className="mt-0.5 text-xs text-muted">Richiamo {formatDateTime(log.callback_at)}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
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
      <article className="card-surface p-4">
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

        <a href={phoneLink} className="mt-2 block break-words text-lg font-semibold text-primary-700 hover:underline">
          {company.phone}
        </a>

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
              className="min-h-11 w-full px-2 text-sm sm:w-auto"
              disabled={busy}
              onClick={() => handleOutcome(item.outcome)}
            >
              {item.label}
            </Button>
          ))}
          <Button
            variant="secondary"
            className="col-span-2 min-h-11 w-full text-sm sm:w-auto"
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
