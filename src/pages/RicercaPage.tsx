import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookmarkPlus, Search as SearchIcon, Trash2 } from 'lucide-react'
import { CompanyDrawer } from '../components/companies/CompanyDrawer'
import { CompanyTable } from '../components/companies/CompanyTable'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Input, controlClassName } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { useCollaborators } from '../hooks/useCollaborators'
import { useCompanies } from '../hooks/useCompanies'
import { useProfile } from '../hooks/useProfile'
import {
  useCreateSavedSearch,
  useDeleteSavedSearch,
  useSavedSearches,
  useSearchGeoOptions,
  useUpdateSavedSearch,
} from '../hooks/useSearches'
import type { CompanySortKey } from '../lib/companies'
import { formatDate } from '../lib/format'
import { statusLabel } from '../lib/labels'
import { errorMessage } from '../lib/validators'
import {
  COMPANY_STATUSES,
  type Company,
  type CompanyListParams,
  type CompanyStatus,
  type SavedSearch,
  type SavedSearchDraft,
} from '../types'

const PAGE_SIZE = 25
const emptyCompanies: Company[] = []

type LiveFilters = {
  search: string
  status: CompanyStatus | 'all'
  region: string
  province: string
  city: string
  assignee: string
  phone: 'all' | 'yes' | 'no'
}

const initialFilters: LiveFilters = {
  search: '',
  status: 'all',
  region: 'all',
  province: 'all',
  city: 'all',
  assignee: 'all',
  phone: 'all',
}

function filtersToDraft(filters: LiveFilters, name: string): SavedSearchDraft {
  return {
    name: name.trim(),
    query: filters.search.trim(),
    region: filters.region === 'all' ? null : filters.region,
    province: filters.province === 'all' ? null : filters.province,
    city: filters.city === 'all' ? null : filters.city,
    status: filters.status === 'all' ? null : filters.status,
  }
}

function filtersFromSaved(search: SavedSearch): LiveFilters {
  return {
    ...initialFilters,
    search: search.query,
    status: search.status ?? 'all',
    region: search.region ?? 'all',
    province: search.province ?? 'all',
    city: search.city ?? 'all',
  }
}

function filtersActive(filters: LiveFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.status !== 'all' ||
    filters.region !== 'all' ||
    filters.province !== 'all' ||
    filters.city !== 'all' ||
    filters.assignee !== 'all' ||
    filters.phone !== 'all'
  )
}

function summarizeFilters(filters: LiveFilters): string {
  const parts: string[] = []
  if (filters.search.trim()) parts.push(`“${filters.search.trim()}”`)
  if (filters.status !== 'all') parts.push(statusLabel(filters.status))
  if (filters.region !== 'all') parts.push(filters.region)
  if (filters.province !== 'all') parts.push(filters.province)
  if (filters.city !== 'all') parts.push(filters.city)
  if (filters.assignee === 'none') parts.push('Non assegnate')
  if (filters.phone === 'yes') parts.push('Con telefono')
  if (filters.phone === 'no') parts.push('Senza telefono')
  return parts.length > 0 ? parts.join(' · ') : 'Nessun filtro'
}

function summarizeSaved(search: SavedSearch): string {
  return summarizeFilters(filtersFromSaved(search))
}

function toAziendeQuery(filters: LiveFilters): string {
  const params = new URLSearchParams()
  if (filters.search.trim()) params.set('q', filters.search.trim())
  if (filters.status !== 'all') params.set('status', filters.status)
  if (filters.region !== 'all') params.set('region', filters.region)
  if (filters.province !== 'all') params.set('province', filters.province)
  if (filters.city !== 'all') params.set('city', filters.city)
  if (filters.assignee !== 'all') params.set('assignee', filters.assignee)
  if (filters.phone !== 'all') params.set('phone', filters.phone)
  const qs = params.toString()
  return qs ? `/aziende?${qs}` : '/aziende'
}

export function RicercaPage() {
  const navigate = useNavigate()
  const { profile, loading } = useProfile()
  const peopleQuery = useCollaborators()
  const savedQuery = useSavedSearches(profile?.role === 'admin')
  const createSearch = useCreateSavedSearch()
  const updateSearch = useUpdateSavedSearch()
  const deleteSearch = useDeleteSavedSearch()

  const [filters, setFilters] = useState<LiveFilters>(initialFilters)
  const [sort, setSort] = useState<{ key: CompanySortKey; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' })
  const [page, setPage] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const geoQuery = useSearchGeoOptions(
    { region: filters.region, province: filters.province },
    profile?.role === 'admin',
  )

  const listParams = useMemo<CompanyListParams>(
    () => ({
      search: filters.search,
      status: filters.status,
      region: filters.region,
      province: filters.province,
      city: filters.city,
      assignee: filters.assignee,
      phone: filters.phone,
      sortKey: sort.key,
      sortDir: sort.dir,
      page,
      pageSize: PAGE_SIZE,
    }),
    [filters, sort, page],
  )

  const resultsQuery = useCompanies(profile, listParams)
  const companies = resultsQuery.data?.companies ?? emptyCompanies
  const total = resultsQuery.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const people = peopleQuery.data ?? []
  const saved = savedQuery.data ?? []
  const openCompany = companies.find((company) => company.id === openId) ?? null
  const emptySelected = useMemo(() => new Set<string>(), [])

  useEffect(() => {
    setPage(0)
  }, [filters, sort])

  useEffect(() => {
    if (openId && !companies.some((company) => company.id === openId)) setOpenId(null)
  }, [companies, openId])

  const patchFilters = (patch: Partial<LiveFilters>) => {
    setActiveSavedId(null)
    setFilters((current) => ({ ...current, ...patch }))
  }

  const applySaved = (search: SavedSearch) => {
    setFilters(filtersFromSaved(search))
    setActiveSavedId(search.id)
    setPage(0)
  }

  const openSaveModal = (search?: SavedSearch) => {
    if (search) {
      setEditingId(search.id)
      setSaveName(search.name)
      setFilters(filtersFromSaved(search))
      setActiveSavedId(search.id)
    } else {
      setEditingId(null)
      setSaveName(activeSavedId ? saved.find((item) => item.id === activeSavedId)?.name ?? '' : '')
    }
    setSaveOpen(true)
  }

  const submitSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!profile) return
    const name = saveName.trim()
    if (!name) return
    const draft = filtersToDraft(filters, name)
    if (editingId) {
      await updateSearch.mutateAsync({ id: editingId, draft })
      setActiveSavedId(editingId)
    } else {
      const created = await createSearch.mutateAsync({
        draft,
        actor: { id: profile.id, full_name: profile.full_name, role: profile.role },
      })
      setActiveSavedId(created.id)
    }
    setSaveOpen(false)
  }

  const onSort = (key: CompanySortKey) => {
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    )
  }

  if (loading || !profile) {
    return (
      <section>
        <PageHeader title="Ricerca" />
        <div className="flex justify-center py-24">
          <Spinner className="h-8 w-8 text-primary-600" />
        </div>
      </section>
    )
  }

  const regions = geoQuery.data?.regions ?? []
  const provinces = geoQuery.data?.provinces ?? []
  const cities = geoQuery.data?.cities ?? []
  const saving = createSearch.isPending || updateSearch.isPending

  return (
    <section>
      <PageHeader
        title="Ricerca"
        description="Filtra il portafoglio, salva le ricerche frequenti e aprila in Aziende."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={!filtersActive(filters)} onClick={() => openSaveModal()}>
              <BookmarkPlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Salva ricerca
            </Button>
            <Button variant="secondary" onClick={() => navigate(toAziendeQuery(filters))}>
              Apri in Aziende
            </Button>
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-line bg-surface p-4 md:p-5">
            <div className="mb-4 flex items-center gap-2">
              <SearchIcon className="h-4 w-4 text-primary-600" aria-hidden="true" />
              <h2 className="text-sm font-semibold tracking-tight text-ink">Filtri</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block sm:col-span-2 lg:col-span-3">
                <span className="mb-1.5 block text-sm font-medium text-ink">Testo</span>
                <input
                  value={filters.search}
                  placeholder="Nome, città, telefono o email"
                  className={controlClassName}
                  onChange={(event) => patchFilters({ search: event.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">Stato</span>
                <select
                  className={controlClassName}
                  value={filters.status}
                  onChange={(event) =>
                    patchFilters({
                      status: event.target.value === 'all' ? 'all' : (event.target.value as CompanyStatus),
                    })
                  }
                >
                  <option value="all">Tutti gli stati</option>
                  {COMPANY_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">Regione</span>
                <select
                  className={controlClassName}
                  value={filters.region}
                  onChange={(event) => patchFilters({ region: event.target.value, province: 'all', city: 'all' })}
                >
                  <option value="all">Tutte le regioni</option>
                  {regions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">Provincia</span>
                <select
                  className={controlClassName}
                  value={filters.province}
                  onChange={(event) => patchFilters({ province: event.target.value, city: 'all' })}
                >
                  <option value="all">Tutte le province</option>
                  {provinces.map((province) => (
                    <option key={province} value={province}>
                      {province}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">Città</span>
                <select
                  className={controlClassName}
                  value={filters.city}
                  onChange={(event) => patchFilters({ city: event.target.value })}
                >
                  <option value="all">Tutte le città</option>
                  {cities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">Assegnato a</span>
                <select
                  className={controlClassName}
                  value={filters.assignee}
                  onChange={(event) => patchFilters({ assignee: event.target.value })}
                >
                  <option value="all">Tutti</option>
                  <option value="none">Non assegnate</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.active ? person.full_name : `${person.full_name} (disattivo)`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">Telefono</span>
                <select
                  className={controlClassName}
                  value={filters.phone}
                  onChange={(event) =>
                    patchFilters({
                      phone:
                        event.target.value === 'yes' || event.target.value === 'no' ? event.target.value : 'all',
                    })
                  }
                >
                  <option value="all">Con e senza</option>
                  <option value="yes">Con telefono</option>
                  <option value="no">Senza telefono</option>
                </select>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <p className="mr-auto text-sm text-muted">{summarizeFilters(filters)}</p>
              <Button variant="ghost" className="px-2" onClick={() => { setFilters(initialFilters); setActiveSavedId(null) }}>
                Azzera
              </Button>
            </div>
          </div>

          {resultsQuery.isError ? (
            <EmptyState
              title="Impossibile caricare i risultati"
              description={errorMessage(resultsQuery.error)}
              action={<Button onClick={() => void resultsQuery.refetch()}>Riprova</Button>}
            />
          ) : resultsQuery.isPending ? (
            <div className="flex justify-center py-16">
              <Spinner className="h-8 w-8 text-primary-600" />
            </div>
          ) : total === 0 ? (
            <EmptyState
              title={filtersActive(filters) ? 'Nessun risultato' : 'Inizia una ricerca'}
              description={
                filtersActive(filters)
                  ? 'Nessuna azienda corrisponde ai filtri impostati.'
                  : 'Imposta uno o più filtri per trovare aziende nel portafoglio.'
              }
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted">
                  <span className="font-semibold tabular-nums text-ink">{total}</span> aziende trovate
                  {activeSavedId ? ' · ricerca salvata' : ''}
                </p>
                {pageCount > 1 ? (
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                      Precedente
                    </Button>
                    <span className="text-sm tabular-nums text-muted">
                      {page + 1} / {pageCount}
                    </span>
                    <Button
                      variant="secondary"
                      disabled={page >= pageCount - 1}
                      onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    >
                      Successiva
                    </Button>
                  </div>
                ) : null}
              </div>

              <CompanyTable
                rows={companies}
                people={people}
                showEmail
                showEmployees={false}
                sort={sort}
                onSort={onSort}
                selectable={false}
                selected={emptySelected}
                onToggle={() => undefined}
                onTogglePage={() => undefined}
                onOpen={(company) => setOpenId(company.id)}
              />
            </>
          )}
        </div>

        <aside className="min-w-0">
          <div className="rounded-2xl border border-line bg-surface p-4 md:sticky md:top-24">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-ink">Ricerche salvate</h2>
              <span className="text-xs tabular-nums text-muted">{saved.length}</span>
            </div>

            {savedQuery.isError ? (
              <p className="text-sm text-danger-fg">{errorMessage(savedQuery.error)}</p>
            ) : savedQuery.isPending ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-6 w-6 text-primary-600" />
              </div>
            ) : saved.length === 0 ? (
              <p className="text-sm leading-relaxed text-muted">
                Salva filtri frequenti (es. “Lombardia da chiamare”) per riapplicarli in un click.
              </p>
            ) : (
              <ul className="space-y-2">
                {saved.map((search) => {
                  const active = activeSavedId === search.id
                  return (
                    <li
                      key={search.id}
                      className={`rounded-xl border px-3 py-2.5 transition-colors ${
                        active ? 'border-primary-300 bg-primary-50' : 'border-line bg-canvas/60'
                      }`}
                    >
                      <button type="button" className="w-full text-left" onClick={() => applySaved(search)}>
                        <p className="truncate text-sm font-medium text-ink">{search.name}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted">{summarizeSaved(search)}</p>
                        <p className="mt-1 text-[11px] text-muted">{formatDate(search.created_at)}</p>
                      </button>
                      <div className="mt-2 flex gap-1">
                        <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => openSaveModal(search)}>
                          Modifica
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-8 px-2 text-xs text-danger-fg"
                          loading={deleteSearch.isPending}
                          onClick={() => {
                            if (activeSavedId === search.id) setActiveSavedId(null)
                            void deleteSearch.mutateAsync(search.id)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <CompanyDrawer company={openCompany} people={people} profile={profile} onClose={() => setOpenId(null)} />

      <Modal
        open={saveOpen}
        title={editingId ? 'Modifica ricerca' : 'Salva ricerca'}
        description="Il nome serve per ritrovare i filtri in seguito."
        onClose={() => !saving && setSaveOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSaveOpen(false)} disabled={saving}>
              Annulla
            </Button>
            <Button type="submit" form="save-search-form" loading={saving} disabled={!saveName.trim()}>
              {editingId ? 'Aggiorna' : 'Salva'}
            </Button>
          </>
        }
      >
        <form id="save-search-form" className="space-y-4" onSubmit={(event) => void submitSave(event)} noValidate>
          <Input
            label="Nome ricerca"
            value={saveName}
            placeholder="Es. Lombardia da chiamare"
            onChange={(event) => setSaveName(event.target.value)}
            autoFocus
          />
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Filtri</p>
            <p className="rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-muted">
              {summarizeFilters(filters)}
            </p>
          </div>
        </form>
      </Modal>
    </section>
  )
}