import { useMemo, useState } from 'react'
import { CallCard } from '../components/calls/CallCard'
import { CallbackModal } from '../components/calls/CallbackModal'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Input, Select } from '../components/ui/Input'
import { Spinner } from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import { useCallQueue, useClaimCompany, useRecordCall, useReleaseCompany, useUndoCall } from '../hooks/useCalls'
import { useAssignCompany } from '../hooks/useCompanies'
import { useCollaborators } from '../hooks/useCollaborators'
import { useProfile } from '../hooks/useProfile'
import { filterCallCompanies, matchesCallTab, sortCallQueue, uniqueSorted, type CallTab } from '../lib/calls'
import { errorMessage } from '../lib/validators'
import type { Company, CompanyStatus } from '../types'

const TABS: { id: CallTab; label: string }[] = [
  { id: 'da_chiamare', label: 'Da chiamare' },
  { id: 'da_richiamare', label: 'Da richiamare' },
  { id: 'mie', label: 'Le mie' },
  { id: 'chiusi', label: 'Chiusi' },
]

export function ChiamatePage() {
  const { profile, loading } = useProfile()
  const queue = useCallQueue(profile)
  const peopleQuery = useCollaborators()
  const record = useRecordCall(profile)
  const undo = useUndoCall(profile)
  const claim = useClaimCompany(profile)
  const release = useReleaseCompany(profile)
  const assign = useAssignCompany(profile)
  const toast = useToast()
  const [tab, setTab] = useState<CallTab>('da_chiamare')
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState('')
  const [province, setProvince] = useState('')
  const [city, setCity] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [callbackFor, setCallbackFor] = useState<Company | null>(null)

  const people = peopleQuery.data ?? []
  const companies = queue.data?.companies ?? []
  const logs = queue.data?.logs ?? []

  const filtered = useMemo(
    () => filterCallCompanies(companies, { query, region, province, city }),
    [companies, query, region, province, city],
  )

  const counts = useMemo(() => {
    const next = { da_chiamare: 0, da_richiamare: 0, mie: 0, chiusi: 0 }
    if (!profile) return next
    for (const company of filtered) {
      for (const item of TABS) {
        if (matchesCallTab(company, item.id, profile.id)) next[item.id] += 1
      }
    }
    return next
  }, [filtered, profile])

  const visible = useMemo(() => {
    if (!profile) return []
    return sortCallQueue(
      filtered.filter((company) => matchesCallTab(company, tab, profile.id)),
      tab,
      logs,
    )
  }, [filtered, logs, profile, tab])

  const regions = uniqueSorted(companies.map((company) => company.region))
  const provinces = uniqueSorted(
    companies.filter((company) => !region || company.region === region).map((company) => company.province),
  )
  const cities = uniqueSorted(
    companies
      .filter((company) => (!region || company.region === region) && (!province || company.province === province))
      .map((company) => company.city),
  )

  const busyId =
    (record.isPending ? record.variables?.companyId : null) ??
    (claim.isPending ? claim.variables : null) ??
    (release.isPending ? release.variables : null) ??
    (assign.isPending ? assign.variables?.id : null) ??
    null

  const saveOutcome = (company: Company, outcome: CompanyStatus, callbackAt: string | null) => {
    if (!profile) return
    const wasPool = company.assignee_id === null && profile.role === 'collaboratore'
    record.mutate(
      {
        companyId: company.id,
        outcome,
        note: notes[company.id]?.trim() ? notes[company.id].trim() : null,
        callbackAt,
      },
      {
        onSuccess: (result) => {
          setNotes((current) => ({ ...current, [company.id]: '' }))
          setCallbackFor(null)
          toast.success(wasPool ? 'Esito registrato e azienda presa in carico' : 'Esito registrato', {
            label: 'Annulla',
            onClick: () => undo.mutate(result.log.id),
          })
        },
      },
    )
  }

  if (loading || !profile || queue.isPending) {
    return (
      <section>
        <PageHeader title="Chiamate" />
        <div className="flex justify-center py-24">
          <Spinner className="h-8 w-8 text-indigo-600" />
        </div>
      </section>
    )
  }

  if (queue.isError) {
    return (
      <section>
        <PageHeader title="Chiamate" description="Aziende con un numero di telefono." />
        <EmptyState
          title="Impossibile caricare le chiamate"
          description={errorMessage(queue.error)}
          action={<Button onClick={() => void queue.refetch()}>Riprova</Button>}
        />
      </section>
    )
  }

  return (
    <section>
      <PageHeader
        title="Chiamate"
        description={
          profile.role === 'admin'
            ? 'Tutte le aziende con telefono. Puoi riassegnarle o rimetterle nel pool.'
            : 'Le aziende assegnate a te e quelle ancora nel pool.'
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input label="Cerca per nome" value={query} placeholder="Nome azienda" onChange={(event) => setQuery(event.target.value)} />
        <Select
          label="Regione"
          value={region}
          onChange={(event) => {
            setRegion(event.target.value)
            setProvince('')
            setCity('')
          }}
        >
          <option value="">Tutte</option>
          {regions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <Select
          label="Provincia"
          value={province}
          onChange={(event) => {
            setProvince(event.target.value)
            setCity('')
          }}
        >
          <option value="">Tutte</option>
          {provinces.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <Select label="Città" value={city} onChange={(event) => setCity(event.target.value)}>
          <option value="">Tutte</option>
          {cities.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((item) => {
          const selected = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              className={`min-h-11 shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                selected ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'
              }`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
              <span className={`ml-2 tabular-nums ${selected ? 'text-indigo-100' : 'text-slate-500'}`}>{counts[item.id]}</span>
            </button>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <EmptyState title="Nessuna azienda in questa scheda" description="Prova un’altra scheda o allenta i filtri." />
      ) : (
        <div className="space-y-2">
          {visible.map((company) => (
            <CallCard
              key={company.id}
              company={company}
              logs={logs}
              people={people}
              profile={profile}
              note={notes[company.id] ?? ''}
              busy={busyId === company.id}
              onNote={(value) => setNotes((current) => ({ ...current, [company.id]: value }))}
              onOutcome={(outcome) => saveOutcome(company, outcome, null)}
              onCallback={() => setCallbackFor(company)}
              onClaim={() => claim.mutate(company.id)}
              onAssign={(assigneeId) => assign.mutate({ id: company.id, assigneeId })}
              onRelease={() => release.mutate(company.id)}
            />
          ))}
        </div>
      )}

      <CallbackModal
        open={callbackFor !== null}
        companyName={callbackFor?.name ?? ''}
        pending={record.isPending && record.variables?.companyId === callbackFor?.id}
        onClose={() => setCallbackFor(null)}
        onConfirm={(callbackAt) => {
          if (!callbackFor) return
          saveOutcome(callbackFor, 'da_richiamare', callbackAt)
        }}
      />
    </section>
  )
}
