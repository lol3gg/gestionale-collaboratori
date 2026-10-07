import { useMemo, useState } from 'react'
import { useToast } from '../components/ui/Toast'
import {
  CALL_TABS,
  filterCallCompanies,
  matchesCallTab,
  sortCallQueue,
  uniqueSorted,
  type CallTab,
} from '../lib/calls'
import type { Company, CompanyStatus, Profile } from '../types'
import { useAssignCompany } from './useCompanies'
import { useCallQueue, useClaimCompany, useRecordCall, useReleaseCompany, useUndoCall } from './useCalls'
import { useCollaborators } from './useCollaborators'

export function useCallQueueBoard(profile: Profile | null) {
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
    [city, companies, province, query, region],
  )

  const counts = useMemo(() => {
    const next: Record<CallTab, number> = { da_chiamare: 0, da_richiamare: 0, mie: 0, chiusi: 0 }
    if (!profile) return next
    for (const company of filtered) {
      for (const item of CALL_TABS) {
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

  return {
    queue,
    people,
    logs,
    tab,
    setTab,
    query,
    setQuery,
    region,
    setRegion,
    province,
    setProvince,
    city,
    setCity,
    notes,
    setNotes,
    callbackFor,
    setCallbackFor,
    counts,
    visible,
    regions,
    provinces,
    cities,
    busyId,
    record,
    undo,
    claim,
    release,
    assign,
    saveOutcome,
  }
}
