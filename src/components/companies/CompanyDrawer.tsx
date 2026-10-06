import { useEffect, useState } from 'react'
import { CompanyFields } from './CompanyFields'
import { companyAssigneeLabel } from './CompanyTable'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Input, Select } from '../ui/Input'
import { useAddCompanyNote, useAssignCompany, useUpdateCompany } from '../../hooks/useCompanies'
import { useCompanyCalls, useRecordCall } from '../../hooks/useCalls'
import { callbackIso } from '../../lib/calls'
import { formatDate, formatDateTime } from '../../lib/format'
import { statusLabel } from '../../lib/labels'
import { errorMessage } from '../../lib/validators'
import { telHref } from '../../lib/phone'
import {
  isCompanyStatus,
  validateCompanyDetails,
  websiteHref,
  websiteLabel,
  type CompanyFormErrors,
  type CompanyFormInput,
} from '../../lib/companies'
import { COMPANY_STATUSES, type Collaborator, type Company, type Profile } from '../../types'

function toForm(company: Company): CompanyFormInput {
  return {
    name: company.name,
    phone: company.phone,
    email: company.email ?? '',
    website: company.website,
    address: company.address ?? '',
    city: company.city,
    province: company.province,
    region: company.region,
    employees: company.employees === null ? '' : String(company.employees),
  }
}

function Field({ label, children }: { label: string; children: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{children || '—'}</dd>
    </div>
  )
}

type CompanyDrawerProps = {
  company: Company | null
  people: Collaborator[]
  profile: Profile
  onClose: () => void
}

export function CompanyDrawer({ company, people, profile, onClose }: CompanyDrawerProps) {
  const isAdmin = profile.role === 'admin'
  const [form, setForm] = useState<CompanyFormInput | null>(null)
  const [errors, setErrors] = useState<CompanyFormErrors>({})
  const [note, setNote] = useState('')
  const [callbackAt, setCallbackAt] = useState('')
  const [callbackError, setCallbackError] = useState('')
  const [draftStatus, setDraftStatus] = useState<Company['status'] | null>(null)
  const update = useUpdateCompany(profile)
  const record = useRecordCall(profile)
  const assign = useAssignCompany(profile)
  const addNote = useAddCompanyNote(profile)
  const calls = useCompanyCalls(company?.id ?? null, profile)

  useEffect(() => {
    setForm(company ? toForm(company) : null)
    setErrors({})
    setNote('')
  }, [company?.id])

  useEffect(() => {
    setCallbackAt('')
    setCallbackError('')
    setDraftStatus(null)
  }, [company?.id, company?.status])

  const activePeople = people.filter((person) => person.active && person.role === 'collaboratore')
  const currentAssignee = people.find((person) => person.id === company?.assignee_id) ?? null
  const assigneeOptions =
    currentAssignee && !activePeople.some((person) => person.id === currentAssignee.id)
      ? [...activePeople, currentAssignee]
      : activePeople

  const notes = company ? [...company.notes].sort((left, right) => left.created_at.localeCompare(right.created_at)) : []

  return (
    <Drawer
      open={company !== null}
      title={company?.name ?? 'Azienda'}
      description={company ? `Inserita il ${formatDate(company.created_at)}` : undefined}
      onClose={onClose}
    >
      {company && form ? (
        <div className="space-y-8">
          <Select
            label="Stato"
            value={draftStatus ?? company.status}
            disabled={record.isPending}
            onChange={(event) => {
              const value = event.target.value
              if (!isCompanyStatus(value)) return
              if (value === 'da_richiamare') {
                setDraftStatus('da_richiamare')
                setCallbackError('')
                return
              }
              if (value === company.status) {
                setDraftStatus(null)
                return
              }
              setDraftStatus(null)
              record.mutate({ companyId: company.id, outcome: value, note: null, callbackAt: null })
            }}
          >
            {COMPANY_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </Select>
          {company.callback_at ? (
            <p className="text-sm text-slate-600">Prossimo richiamo: {formatDateTime(company.callback_at)}</p>
          ) : null}
          {draftStatus === 'da_richiamare' ? (
            <div className="space-y-3 rounded-xl border border-orange-200 bg-orange-50 p-3">
              <Input
                label="Data e ora del richiamo"
                type="datetime-local"
                value={callbackAt}
                error={callbackError}
                onChange={(event) => {
                  setCallbackAt(event.target.value)
                  setCallbackError('')
                }}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDraftStatus(null)
                    setCallbackAt('')
                    setCallbackError('')
                  }}
                >
                  Annulla
                </Button>
                <Button
                  loading={record.isPending}
                  onClick={() => {
                    const iso = callbackIso(callbackAt)
                    if (!iso || new Date(iso).getTime() <= Date.now()) {
                      setCallbackError('Scegli una data e un orario futuri')
                      return
                    }
                    record.mutate(
                      { companyId: company.id, outcome: 'da_richiamare', note: null, callbackAt: iso },
                      {
                        onSuccess: () => {
                          setDraftStatus(null)
                          setCallbackAt('')
                        },
                      },
                    )
                  }}
                >
                  Conferma richiamo
                </Button>
              </div>
            </div>
          ) : null}

          {isAdmin ? (
            <Select
              label="Assegnata a"
              value={company.assignee_id ?? ''}
              disabled={assign.isPending}
              onChange={(event) => {
                const value = event.target.value || null
                if (value === company.assignee_id) return
                assign.mutate({ id: company.id, assigneeId: value })
              }}
            >
              <option value="">Non assegnata</option>
              {assigneeOptions.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.active ? person.full_name : `${person.full_name} (disattivo)`}
                </option>
              ))}
            </Select>
          ) : (
            <Field label="Assegnata a">{companyAssigneeLabel(company.assignee_id, people)}</Field>
          )}

          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Dati anagrafici</h3>
            {isAdmin ? (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  const parsed = validateCompanyDetails(form)
                  setErrors(parsed.errors)
                  if (!parsed.details) return
                  update.mutate(
                    { id: company.id, details: parsed.details },
                    { onSuccess: (saved) => setForm(toForm(saved)) },
                  )
                }}
              >
                <CompanyFields
                  value={form}
                  errors={errors}
                  onChange={(patch) => setForm((current) => (current ? { ...current, ...patch } : current))}
                />
                <div className="flex justify-end">
                  <Button type="submit" loading={update.isPending}>
                    Salva dati
                  </Button>
                </div>
              </form>
            ) : (
              <dl className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome">{company.name}</Field>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Telefono</dt>
                  <dd className="mt-1 text-sm text-slate-900">
                    {company.phone ? (
                      <a href={telHref(company.phone)} className="text-indigo-700 hover:underline">
                        {company.phone}
                      </a>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                <Field label="Email">{company.email ?? ''}</Field>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Sito</dt>
                  <dd className="mt-1 text-sm">
                    {websiteHref(company.website) ? (
                      <a
                        href={websiteHref(company.website)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-700 hover:underline"
                      >
                        {websiteLabel(company.website)}
                      </a>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Indirizzo">{company.address ?? ''}</Field>
                </div>
                <Field label="Città">{company.city}</Field>
                <Field label="Provincia">{company.province}</Field>
                <Field label="Regione">{company.region}</Field>
                <Field label="Dipendenti">{company.employees === null ? '' : String(company.employees)}</Field>
              </dl>
            )}
            {!isAdmin ? (
              <p className="mt-3 text-xs text-slate-500">Puoi aggiornare lo stato, le note e la data del richiamo.</p>
            ) : null}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-900">Chiamate</h3>
            {calls.isPending ? <p className="mt-2 text-sm text-slate-500">Caricamento cronologia…</p> : null}
            {calls.isError ? <p className="mt-2 text-sm text-red-600">{errorMessage(calls.error)}</p> : null}
            {calls.isSuccess && calls.data.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Nessuna chiamata registrata.</p>
            ) : null}
            {calls.isSuccess && calls.data.length > 0 ? (
              <ol className="mt-3 space-y-3">
                {calls.data.map((item) => {
                  const author =
                    people.find((person) => person.id === item.user_id)?.full_name ??
                    (item.user_id === profile.id ? profile.full_name : 'Collaboratore')
                  return (
                    <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-sm font-medium text-slate-900">{statusLabel(item.outcome)}</p>
                      {item.note ? <p className="mt-1 text-sm text-slate-700">{item.note}</p> : null}
                      {item.callback_at ? (
                        <p className="mt-1 text-xs text-slate-500">Richiamo {formatDateTime(item.callback_at)}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-500">
                        {author} · {formatDateTime(item.created_at)}
                      </p>
                    </li>
                  )
                })}
              </ol>
            ) : null}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-900">Note</h3>
            {notes.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Nessuna nota.</p>
            ) : (
              <ol className="mt-3 space-y-3">
                {notes.map((item) => (
                  <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-sm text-slate-800">{item.body}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.author_name} · {formatDateTime(item.created_at)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
            <form
              className="mt-4 space-y-2"
              onSubmit={(event) => {
                event.preventDefault()
                const body = note.trim()
                if (body.length < 2) return
                addNote.mutate(
                  { id: company.id, body },
                  { onSuccess: () => setNote('') },
                )
              }}
            >
              <label className="block text-sm font-medium text-slate-700" htmlFor="company-note">
                Nuova nota
              </label>
              <textarea
                id="company-note"
                value={note}
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                placeholder="Scrivi una nota"
                onChange={(event) => setNote(event.target.value)}
              />
              <div className="flex justify-end">
                <Button type="submit" loading={addNote.isPending} disabled={note.trim().length < 2}>
                  Aggiungi nota
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </Drawer>
  )
}
