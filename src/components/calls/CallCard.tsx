import { CompanyStatusBadge } from '../companies/CompanyStatusBadge'
import { companyAssigneeLabel } from '../companies/CompanyTable'
import { attemptsToday } from '../../lib/calls'
import { formatDateTime } from '../../lib/format'
import { websiteHref, websiteLabel } from '../../lib/companies'
import { telHref } from '../../lib/phone'
import type { CallLog, Collaborator, Company, CompanyStatus, Profile } from '../../types'
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
  onNote: (value: string) => void
  onOutcome: (outcome: CompanyStatus) => void
  onCallback: () => void
  onClaim: () => void
  onAssign: (assigneeId: string) => void
  onRelease: () => void
}

export function CallCard({
  company,
  logs,
  people,
  profile,
  note,
  busy,
  onNote,
  onOutcome,
  onCallback,
  onClaim,
  onAssign,
  onRelease,
}: CallCardProps) {
  const attempts = attemptsToday(company.id, logs)
  const site = websiteHref(company.website)
  const isAdmin = profile.role === 'admin'
  const activePeople = people.filter((person) => person.active && person.role === 'collaboratore')
  const current = people.find((person) => person.id === company.assignee_id) ?? null
  const options =
    current && !activePeople.some((person) => person.id === current.id) ? [...activePeople, current] : activePeople

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="break-words text-base font-semibold text-slate-950">{company.name}</h2>
          <p className="text-xs text-slate-500">
            {company.city} ({company.province}) · {company.region}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <CompanyStatusBadge status={company.status} />
          {attempts > 0 ? (
            <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-950">
              Tentativo n. {attempts}
            </span>
          ) : null}
        </div>
      </div>

      <a
        href={telHref(company.phone)}
        className="mt-2 block break-words text-lg font-semibold text-indigo-700 hover:underline"
      >
        {company.phone}
      </a>

      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
        {site ? (
          <a href={site} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">
            {websiteLabel(company.website)}
          </a>
        ) : null}
        <span>Assegnata a {companyAssigneeLabel(company.assignee_id, people)}</span>
        {company.callback_at ? <span>Richiamo {formatDateTime(company.callback_at)}</span> : null}
      </div>

      <label className="mt-2 block text-xs font-medium text-slate-600" htmlFor={`nota-${company.id}`}>
        Nota (facoltativa)
      </label>
      <textarea
        id={`nota-${company.id}`}
        value={note}
        rows={1}
        maxLength={2000}
        disabled={busy}
        placeholder="Nota prima dell’esito"
        className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
        onChange={(event) => onNote(event.target.value)}
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {OUTCOMES.map((item) => (
          <Button
            key={item.outcome}
            variant="secondary"
            className="!min-h-0 !px-2.5 !py-1 !text-xs"
            disabled={busy}
            onClick={() => onOutcome(item.outcome)}
          >
            {item.label}
          </Button>
        ))}
        <Button variant="secondary" className="!min-h-0 !px-2.5 !py-1 !text-xs" disabled={busy} onClick={onCallback}>
          Da richiamare
        </Button>
      </div>

      {!isAdmin && company.assignee_id === null ? (
        <div className="mt-2">
          <Button className="!min-h-0 !px-2.5 !py-1 !text-xs" disabled={busy} onClick={onClaim}>
            Prendi in carico
          </Button>
        </div>
      ) : null}

      {isAdmin ? (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Select
              label="Riassegna"
              value={company.assignee_id ?? ''}
              disabled={busy}
              onChange={(event) => {
                const value = event.target.value
                if (value && value !== company.assignee_id) onAssign(value)
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
            <Button variant="secondary" className="!min-h-0 !px-2.5 !py-1 !text-xs" disabled={busy} onClick={onRelease}>
              Libera
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
