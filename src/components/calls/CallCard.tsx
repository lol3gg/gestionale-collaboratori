import { Phone } from 'lucide-react'
import { attemptsToday, companyCallHistory, latestUndoableLog } from '../../lib/calls'
import { websiteHref, websiteLabel } from '../../lib/companies'
import { formatDateTime } from '../../lib/format'
import { statusLabel } from '../../lib/labels'
import { telHref } from '../../lib/phone'
import type { CallLog, Collaborator, Company, CompanyStatus, Profile } from '../../types'
import { CompanyStatusBadge } from '../companies/CompanyStatusBadge'
import { companyAssigneeLabel } from '../companies/CompanyTable'
import { Button } from '../ui/Button'
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
  onClaim: () => void
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
  onClaim,
  onAssign,
  onRelease,
  onUndo,
}: CallCardProps) {
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

  if (!isAdmin) {
    return (
      <article className="card-surface p-4">
        {phoneLink ? (
          <a
            href={phoneLink}
            className="mb-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-primary-500 to-primary-600 px-4 text-base font-semibold text-white shadow-sm transition duration-150 hover:from-primary-600 hover:to-primary-700 active:scale-[0.98]"
          >
            <Phone className="h-5 w-5" aria-hidden="true" />
            Chiama {company.phone}
          </a>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold tracking-tight text-ink">{company.name}</h2>
            <p className="text-[15px] text-muted">
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

        <div className="mt-2 space-y-1 text-[15px] text-muted">
          {company.email ? (
            <a href={`mailto:${company.email}`} className="block break-all text-primary-700 hover:underline">
              {company.email}
            </a>
          ) : null}
          {site ? (
            <a href={site} target="_blank" rel="noreferrer" className="block break-all text-primary-700 hover:underline">
              {websiteLabel(company.website)}
            </a>
          ) : null}
          {company.employees !== null ? <p>{company.employees} dipendenti</p> : null}
          {company.callback_at ? <p>Richiamo {formatDateTime(company.callback_at)}</p> : null}
        </div>

        <label className="mt-3 block text-sm font-medium text-ink" htmlFor={`nota-${company.id}`}>
          Nota (facoltativa)
        </label>
        <textarea
          id={`nota-${company.id}`}
          value={note}
          rows={2}
          maxLength={2000}
          disabled={busy}
          placeholder="Nota prima dell’esito"
          className="mt-1 w-full min-h-11 rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-ink shadow-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:bg-canvas"
          onChange={(event) => onNote(event.target.value)}
        />

        <div className="mt-3 grid grid-cols-2 gap-2">
          {OUTCOMES.map((item) => (
            <Button
              key={item.outcome}
              variant="secondary"
              className="min-h-11 w-full px-2 text-sm"
              disabled={busy}
              onClick={() => onOutcome(item.outcome)}
            >
              {item.label}
            </Button>
          ))}
          <Button variant="secondary" className="col-span-2 min-h-11 w-full" disabled={busy} onClick={onCallback}>
            Da richiamare
          </Button>
        </div>

        {company.assignee_id === null ? (
          <div className="mt-2">
            <Button className="min-h-11 w-full" disabled={busy} onClick={onClaim}>
              Prendi in carico
            </Button>
          </div>
        ) : null}

        {undoable && onUndo ? (
          <div className="mt-2">
            <Button variant="ghost" className="min-h-11 w-full" disabled={busy} onClick={() => onUndo(undoable.id)}>
              Annulla ultimo esito
            </Button>
          </div>
        ) : null}

        <div className="mt-4 border-t border-line pt-3">
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
                  {log.callback_at ? <p className="mt-0.5 text-xs text-muted">Richiamo {formatDateTime(log.callback_at)}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>
    )
  }

  return (
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
            onClick={() => onOutcome(item.outcome)}
          >
            {item.label}
          </Button>
        ))}
        <Button variant="secondary" className="col-span-2 min-h-11 w-full text-sm sm:w-auto" disabled={busy} onClick={onCallback}>
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
  )
}
