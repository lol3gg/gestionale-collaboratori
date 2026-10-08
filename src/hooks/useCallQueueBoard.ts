import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../components/ui/Toast'
import { CALL_TABS, type CallTab } from '../lib/calls'
import { errorMessage } from '../lib/validators'
import type { Company, CompanyStatus, Profile } from '../types'
import { useAssignCompany } from './useCompanies'
import { useCallQueue, useClaimCompany, useRecordCall, useReleaseCompany, useUndoCall } from './useCalls'
import { useCollaborators } from './useCollaborators'

export const CALL_PAGE_SIZE = 25

export function useCallQueueBoard(profile: Profile | null) {
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
  const [pageCount, setPageCount] = useState(1)

  const params = useMemo(
    () => ({
      tab,
      query: query.trim() || undefined,
      region: region || undefined,
      province: province || undefined,
      city: city || undefined,
      offset: 0,
      limit: pageCount * CALL_PAGE_SIZE,
    }),
    [tab, query, region, province, city, pageCount],
  )

  const queue = useCallQueue(profile, params)

  useEffect(() => {
    setPageCount(1)
  }, [tab, query, region, province, city])

  const people = peopleQuery.data ?? []
  const companies = queue.data?.companies ?? []
  const logs = queue.data?.logs ?? []
  const counts = queue.data?.counts ?? {
    da_chiamare: 0,
    da_riprovare: 0,
    da_richiamare: 0,
    mie: 0,
    chiusi: 0,
  }
  const total = queue.data?.total ?? 0
  const hasMore = companies.length < total

  const regions = queue.data?.regions ?? []
  const provinces = queue.data?.provinces ?? []
  const cities = queue.data?.cities ?? []

  const busyId =
    (record.isPending ? record.variables?.companyId : null) ??
    (claim.isPending ? claim.variables : null) ??
    (release.isPending ? release.variables : null) ??
    (assign.isPending ? assign.variables?.id : null) ??
    null

  const saveOutcome = async (company: Company, outcome: CompanyStatus, callbackAt: string | null) => {
    if (!profile) throw new Error('Sessione non disponibile')
    const wasPool = company.assignee_id === null && profile.role === 'collaboratore'
    try {
      const result = await record.mutateAsync({
        companyId: company.id,
        outcome,
        note: notes[company.id]?.trim() ? notes[company.id].trim() : null,
        callbackAt,
      })
      setNotes((current) => ({ ...current, [company.id]: '' }))
      setCallbackFor(null)
      toast.success(wasPool ? 'Esito registrato e azienda presa in carico' : 'Esito registrato', {
        label: 'Annulla',
        onClick: () => undo.mutate(result.log.id),
      })
      return result
    } catch (error) {
      throw error instanceof Error ? error : new Error(errorMessage(error))
    }
  }

  const loadMore = () => setPageCount((current) => current + 1)

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
    visible: companies,
    visibleTotal: total,
    hasMore,
    loadMore,
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
    tabs: CALL_TABS,
  }
}
