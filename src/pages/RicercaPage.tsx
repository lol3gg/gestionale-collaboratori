import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pause, Play, RefreshCw, Search as SearchIcon, Trash2, Undo2 } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Badge, type BadgeVariant } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { controlClassName } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { useProfile } from '../hooks/useProfile'
import {
  useAddSearchResults,
  useCancelImportBatch,
  useDiscardSearchResults,
  useDeletePlacesSearch,
  useEstimatePlacesSearch,
  usePausePlacesSearch,
  usePlacesSearches,
  useProcessPlacesSearch,
  useResumePlacesSearch,
  useSearchCoverage,
  useSearchGeoOptions,
  useSearchJob,
  useSearchResults,
  useStartPlacesSearch,
} from '../hooks/useSearches'
import { formatDateTime } from '../lib/format'
import { errorMessage } from '../lib/validators'
import {
  KEYWORD_PRESETS,
  SEARCH_COUNTRIES,
  type BatchSummary,
  type PlacesEstimate,
  type PlacesSearch,
  type SearchResultRow,
  type SearchStatus,
} from '../types'

const DEFAULT_MAX = 60

const statusMeta: Record<SearchStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: 'Bozza', variant: 'quiet' },
  queued: { label: 'In coda', variant: 'info' },
  running: { label: 'In corso', variant: 'warning' },
  completed: { label: 'Completata', variant: 'success' },
  partial_error: { label: 'Errore parziale', variant: 'violet' },
  failed: { label: 'Errore', variant: 'danger' },
  cancelled: { label: 'Annullata', variant: 'quiet' },
  paused: { label: 'In pausa', variant: 'info' },
  paused_limit: { label: 'Pausa per limite', variant: 'warning' },
}

function formatEur(value: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value)
}

function summarizeSearch(search: PlacesSearch): string {
  const area = search.regions.length > 0 ? search.regions.join(', ') : search.region ?? ''
  return [area, search.keywords.slice(0, 2).join(', ')].filter(Boolean).join(' · ')
}

export function RicercaPage() {
  const { profile, loading } = useProfile()
  const historyQuery = usePlacesSearches(profile?.role === 'admin')
  const startSearch = useStartPlacesSearch()
  const processSearch = useProcessPlacesSearch()
  const pauseSearch = usePausePlacesSearch()
  const resumeSearch = useResumePlacesSearch()
  const deleteSearch = useDeletePlacesSearch()
  const addResults = useAddSearchResults()
  const discardResults = useDiscardSearchResults()
  const cancelBatch = useCancelImportBatch()
  const estimateMutation = useEstimatePlacesSearch()

  const [country, setCountry] = useState('IT')
  const [regions, setRegions] = useState<string[]>(['Lombardia'])
  const [provinces, setProvinces] = useState<string[]>([])
  const [presetKeywords, setPresetKeywords] = useState<string[]>(['impresa edile'])
  const [customKeyword, setCustomKeyword] = useState('')
  const [maxRequests, setMaxRequests] = useState(DEFAULT_MAX)
  const [autoAdd, setAutoAdd] = useState(true)
  const [estimate, setEstimate] = useState<PlacesEstimate | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [onlyPhone, setOnlyPhone] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [hideDiscarded, setHideDiscarded] = useState(true)

  const geoQuery = useSearchGeoOptions(
    { country, regions },
    profile?.role === 'admin',
  )
  const jobQuery = useSearchJob(activeId, Boolean(activeId))
  const jobStatus = jobQuery.data?.status
  const isActiveRun = jobStatus === 'queued' || jobStatus === 'running'
  const resultsQuery = useSearchResults(activeId, Boolean(activeId), isActiveRun)
  const coverageQuery = useSearchCoverage(activeId, Boolean(activeId), isActiveRun)

  const keywords = useMemo(() => {
    const custom = customKeyword.trim()
    const set = new Set(presetKeywords.map((k) => k.trim()).filter(Boolean))
    if (custom) set.add(custom)
    return [...set]
  }, [presetKeywords, customKeyword])

  const history = historyQuery.data ?? []
  const results = resultsQuery.data ?? []
  const job = jobQuery.data
  const activeSearch = history.find((s) => s.id === activeId) ?? null
  const coverage = coverageQuery.data

  const filteredResults = useMemo(() => {
    return results.filter((row) => {
      if (hideDiscarded && row.discarded) return false
      if (onlyPhone && !row.phone.trim()) return false
      return true
    })
  }, [results, hideDiscarded, onlyPhone])

  const selectableIds = useMemo(
    () =>
      filteredResults
        .filter((r) => !r.discarded && !r.added_company_id && !r.is_duplicate_in_db)
        .map((r) => r.id),
    [filteredResults],
  )

  const processingRef = useRef(false)
  const processMutate = processSearch.mutateAsync
  useEffect(() => {
    if (!activeId || !job) return
    if (job.status !== 'queued' && job.status !== 'running') return
    if (processingRef.current) return

    const timer = window.setTimeout(() => {
      processingRef.current = true
      void processMutate(activeId)
        .catch(() => undefined)
        .finally(() => {
          processingRef.current = false
        })
    }, 800)
    return () => window.clearTimeout(timer)
  }, [activeId, job?.status, job?.pending_cells, job?.completed_queries, processMutate])

  useEffect(() => {
    setSelected(new Set())
  }, [activeId, onlyPhone, hideDiscarded])

  const toggleRegion = (name: string) => {
    setRegions((current) =>
      current.includes(name) ? current.filter((r) => r !== name) : [...current, name],
    )
    setProvinces([])
    setEstimate(null)
  }

  const toggleProvince = (code: string) => {
    setProvinces((current) =>
      current.includes(code) ? current.filter((p) => p !== code) : [...current, code],
    )
    setEstimate(null)
  }

  const togglePreset = (kw: string) => {
    setPresetKeywords((current) =>
      current.includes(kw) ? current.filter((k) => k !== kw) : [...current, kw],
    )
    setEstimate(null)
  }

  const runEstimate = async () => {
    if (regions.length === 0 || keywords.length === 0) {
      setEstimate(null)
      return
    }
    const result = await estimateMutation.mutateAsync({
      regions,
      keywords,
      provinces: provinces.length > 0 ? provinces : undefined,
    })
    setEstimate(result)
    return result
  }

  useEffect(() => {
    if (regions.length === 0 || keywords.length === 0) {
      setEstimate(null)
      return
    }
    const timer = window.setTimeout(() => {
      void estimateMutation
        .mutateAsync({
          regions,
          keywords,
          provinces: provinces.length > 0 ? provinces : undefined,
        })
        .then((result) => setEstimate(result))
        .catch(() => undefined)
    }, 350)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stima solo su filtri
  }, [regions, provinces, keywords, country])

  const openConfirm = async () => {
    const result = await runEstimate()
    if (result) setEstimate(result)
    setConfirmOpen(true)
  }

  const launchSearch = async () => {
    const est = estimate ?? (await runEstimate())
    if (!est) return
    if (est.queries > maxRequests) return
    const result = await startSearch.mutateAsync({
      country,
      regions,
      provinces,
      keywords,
      max_requests: maxRequests,
      estimated_queries: est.queries,
      estimated_cost_eur: est.estimated_cost_eur,
      auto_add: autoAdd,
    })
    setConfirmOpen(false)
    if (result.search_id) setActiveId(result.search_id)
  }

  const relaunch = (search: PlacesSearch) => {
    setCountry(search.country || 'IT')
    setRegions(search.regions.length ? search.regions : search.region ? [search.region] : [])
    setProvinces(search.provinces ?? [])
    const known = new Set<string>(KEYWORD_PRESETS as unknown as string[])
    setPresetKeywords(search.keywords.filter((k) => known.has(k)))
    setCustomKeyword(search.keywords.find((k) => !known.has(k)) ?? '')
    setMaxRequests(search.max_requests || DEFAULT_MAX)
    setAutoAdd(search.auto_add_to_companies)
    setEstimate(null)
    setActiveId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleRow = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const togglePage = () => {
    setSelected((current) => {
      const allSelected = selectableIds.every((id) => current.has(id))
      if (allSelected) return new Set()
      return new Set(selectableIds)
    })
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

  const regionOptions = geoQuery.data?.regions ?? []
  const provinceOptions = geoQuery.data?.provinces ?? []
  const overCap = Boolean(estimate && estimate.queries > maxRequests)
  const needsProvinceSplit = Boolean(
    estimate && estimate.queries > maxRequests && provinces.length === 0 && provinceOptions.length > 0,
  )
  const progressPct =
    coverage && coverage.comuni_total > 0
      ? Math.min(100, Math.round((coverage.comuni_done / coverage.comuni_total) * 100))
      : job && job.comuni_total > 0
        ? Math.min(100, Math.round((job.comuni_done / job.comuni_total) * 100))
        : 0
  const running = activeSearch?.status === 'running' || activeSearch?.status === 'queued'
  const paused = activeSearch?.status === 'paused' || activeSearch?.status === 'paused_limit'
  const costPerReq = estimate?.cost_per_request_eur ?? 0.032
  const usedCost = (activeSearch?.actual_requests ?? 0) * costPerReq
  const summary = activeSearch?.summary

  return (
    <section>
      <PageHeader
        title="Ricerca"
        description="Una ricerca Google Places per comune. Con tetto 60 scegli le province della regione."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-line bg-surface p-4 md:p-5">
            <div className="mb-4 flex items-center gap-2">
              <SearchIcon className="h-4 w-4 text-primary-600" aria-hidden="true" />
              <h2 className="text-sm font-semibold tracking-tight text-ink">Nuova ricerca</h2>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">Paese</span>
                <select
                  className={controlClassName}
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value)
                    setRegions([])
                    setProvinces([])
                    setEstimate(null)
                  }}
                >
                  {SEARCH_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>

              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-ink">Regioni</legend>
                {regionOptions.length === 0 ? (
                  <p className="text-sm text-muted">
                    Nessuna regione con comuni in archivio. Carica il seed OSM/ISTAT su Supabase.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {regionOptions.map((name) => {
                      const on = regions.includes(name)
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => toggleRegion(name)}
                          className={`rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${
                            on
                              ? 'border-primary-400 bg-primary-50 text-primary-800'
                              : 'border-line bg-canvas text-muted hover:text-ink'
                          }`}
                        >
                          {name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </fieldset>

              {regions.length > 0 && provinceOptions.length > 0 ? (
                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium text-ink">
                    Province / aree
                    <span className="ml-1 font-normal text-muted">
                      (obbligatorie se i comuni superano il tetto)
                    </span>
                  </legend>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setProvinces([])
                        setEstimate(null)
                      }}
                      className={`rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${
                        provinces.length === 0
                          ? 'border-primary-400 bg-primary-50 text-primary-800'
                          : 'border-line bg-canvas text-muted hover:text-ink'
                      }`}
                    >
                      Tutta la regione
                    </button>
                    {provinceOptions.map((code) => {
                      const on = provinces.includes(code)
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => toggleProvince(code)}
                          className={`rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${
                            on
                              ? 'border-primary-400 bg-primary-50 text-primary-800'
                              : 'border-line bg-canvas text-muted hover:text-ink'
                          }`}
                        >
                          {code}
                        </button>
                      )
                    })}
                  </div>
                  {needsProvinceSplit ? (
                    <p className="text-xs font-medium text-danger-fg">
                      Troppi comuni per {maxRequests} richieste. Seleziona una o più province (es. MI
                      oppure CO).
                    </p>
                  ) : (
                    <p className="text-xs text-muted">
                      Ogni comune = 1 richiesta Places con la parola chiave scelta.
                    </p>
                  )}
                </fieldset>
              ) : null}

              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-ink">Parole chiave</legend>
                <div className="flex flex-wrap gap-2">
                  {KEYWORD_PRESETS.map((kw) => {
                    const on = presetKeywords.includes(kw)
                    return (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => togglePreset(kw)}
                        className={`rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${
                          on
                            ? 'border-primary-400 bg-primary-50 text-primary-800'
                            : 'border-line bg-canvas text-muted hover:text-ink'
                        }`}
                      >
                        {kw}
                      </button>
                    )
                  })}
                </div>
                <input
                  className={`${controlClassName} mt-2`}
                  placeholder="Altra parola chiave…"
                  value={customKeyword}
                  onChange={(e) => {
                    setCustomKeyword(e.target.value)
                    setEstimate(null)
                  }}
                />
                {keywords.length > 1 ? (
                  <p className="mt-1.5 text-xs text-warning-fg">
                    Più parole chiave moltiplicano le richieste (comuni × parole). Con tetto 60 resta
                    su 1 parola.
                  </p>
                ) : null}
              </fieldset>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">
                  Tetto massimo richieste
                </span>
                <input
                  type="number"
                  min={1}
                  max={20000}
                  className={controlClassName}
                  value={maxRequests}
                  onChange={(e) => {
                    setMaxRequests(Math.max(1, Number(e.target.value) || 1))
                    setEstimate(null)
                  }}
                />
                <span className="mt-1 block text-xs text-muted">
                  Default 60: al massimo 60 comuni con una sola parola chiave.
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-canvas px-3 py-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={autoAdd}
                  onChange={(e) => setAutoAdd(e.target.checked)}
                />
                <span>
                  <span className="block text-sm font-medium text-ink">
                    Aggiungi automaticamente al database
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Attivo: nuove aziende in pool (`da_chiamare`) con lotto. Spento: restano in
                    revisione.
                  </span>
                </span>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                loading={estimateMutation.isPending}
                disabled={regions.length === 0 || keywords.length === 0}
                onClick={() => void runEstimate()}
              >
                Aggiorna stima
              </Button>
              <Button
                disabled={regions.length === 0 || keywords.length === 0 || overCap}
                loading={startSearch.isPending}
                onClick={() => void openConfirm()}
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                Avvia ricerca
              </Button>
            </div>

            {estimate ? (
              <div
                className={`mt-4 rounded-xl border px-3 py-3 text-sm ${
                  overCap ? 'border-danger-dot/30 bg-danger-bg text-danger-fg' : 'border-line bg-canvas text-ink'
                }`}
              >
                <p>
                  <span className="font-semibold tabular-nums">{estimate.comuni}</span> comuni ×{' '}
                  <span className="font-semibold tabular-nums">{estimate.keywords}</span> parole ={' '}
                  <span className="font-semibold tabular-nums">{estimate.queries}</span> richieste
                </p>
                <p className="mt-1 text-muted">
                  Costo indicativo: {formatEur(estimate.estimated_cost_eur)} · tetto {maxRequests}
                </p>
                {overCap ? (
                  <p className="mt-2 font-medium">
                    {needsProvinceSplit
                      ? `Supera il tetto: seleziona le province da coprire ora (restano ${estimate.queries - maxRequests} comuni fuori).`
                      : `Supera il tetto di ${maxRequests}. Riduci province/parole o alza il tetto.`}
                  </p>
                ) : null}
                {estimate.comuni_preview.length > 0 ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-muted hover:text-ink">
                      Comuni che verranno cercati ({estimate.comuni})
                    </summary>
                    <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto text-xs text-muted">
                      {estimate.comuni_preview.map((c) => (
                        <li key={`${c.province}-${c.name}`}>
                          {c.name} ({c.province})
                        </li>
                      ))}
                      {estimate.comuni > estimate.comuni_preview.length ? (
                        <li>… e altri {estimate.comuni - estimate.comuni_preview.length}</li>
                      ) : null}
                    </ul>
                  </details>
                ) : null}
              </div>
            ) : estimateMutation.isPending ? (
              <div className="mt-4 flex justify-center py-3">
                <Spinner className="h-5 w-5 text-primary-600" />
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-ink">Storico</h2>
              <span className="text-xs tabular-nums text-muted">{history.length}</span>
            </div>
            {historyQuery.isError ? (
              <p className="text-sm text-danger-fg">{errorMessage(historyQuery.error)}</p>
            ) : historyQuery.isPending ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-6 w-6 text-primary-600" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted">Nessuna ricerca ancora.</p>
            ) : (
              <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
                {history.map((search) => {
                  const meta = statusMeta[search.status]
                  const active = activeId === search.id
                  return (
                    <li
                      key={search.id}
                      className={`rounded-xl border px-3 py-2.5 ${
                        active ? 'border-primary-300 bg-primary-50' : 'border-line bg-canvas/60'
                      }`}
                    >
                      <button type="button" className="w-full text-left" onClick={() => setActiveId(search.id)}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-medium text-ink">{search.name}</p>
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted">{summarizeSearch(search)}</p>
                        <p className="mt-1 text-[11px] text-muted">
                          {formatDateTime(search.created_at)}
                          {search.auto_add_to_companies ? ' · auto' : ' · revisione'}
                          {search.results_count > 0 ? ` · ${search.results_count} trovate` : ''}
                        </p>
                      </button>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => relaunch(search)}>
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                          Rilancia
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-8 px-2 text-xs text-danger-fg"
                          loading={deleteSearch.isPending}
                          onClick={() => {
                            if (activeId === search.id) setActiveId(null)
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
        </div>

        <div className="min-w-0 space-y-4">
          {!activeId ? (
            <EmptyState
              title="Avvia una ricerca per comuni"
              description="Scegli paese, regione e se serve le province. Con tetto 60 il sistema cerca 1 volta per comune e si ferma al limite."
            />
          ) : (
            <>
              {activeSearch ? (
                <div className="rounded-2xl border border-line bg-surface p-4 md:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-ink">{activeSearch.name}</h2>
                        <Badge variant={statusMeta[activeSearch.status].variant}>
                          {statusMeta[activeSearch.status].label}
                        </Badge>
                        {activeSearch.auto_add_to_companies ? (
                          <Badge variant="info">Auto-add</Badge>
                        ) : (
                          <Badge variant="quiet">Revisione</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted">{summarizeSearch(activeSearch)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {running ? (
                        <Button
                          variant="secondary"
                          loading={pauseSearch.isPending}
                          onClick={() => void pauseSearch.mutateAsync(activeSearch.id)}
                        >
                          <Pause className="h-4 w-4" aria-hidden="true" />
                          Pausa
                        </Button>
                      ) : null}
                      {paused ? (
                        <Button
                          loading={resumeSearch.isPending}
                          onClick={() => void resumeSearch.mutateAsync(activeSearch.id)}
                        >
                          <Play className="h-4 w-4" aria-hidden="true" />
                          Riprendi
                        </Button>
                      ) : null}
                      {activeSearch.import_batch_id ? (
                        <Button variant="danger" onClick={() => setCancelOpen(true)}>
                          <Undo2 className="h-4 w-4" aria-hidden="true" />
                          Annulla questo lotto
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <CoverageCards
                    coverage={coverage}
                    job={job}
                    activeSearch={activeSearch}
                    usedCost={usedCost}
                  />

                  {running || job?.status === 'running' ? (
                    <div className="mt-4">
                      <div className="mb-1.5 flex justify-between text-xs text-muted">
                        <span>
                          Copertura {coverage?.comuni_done ?? job?.comuni_done ?? 0}/
                          {coverage?.comuni_total ?? job?.comuni_total ?? '…'}
                        </span>
                        <span>{progressPct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-canvas">
                        <div
                          className="h-full rounded-full bg-primary-500 transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {activeSearch.error_message || job?.pause_summary ? (
                    <p className="mt-3 rounded-xl border border-warning-dot/25 bg-warning-bg px-3 py-2 text-sm text-warning-fg">
                      {job?.pause_summary ?? activeSearch.error_message}
                    </p>
                  ) : null}

                  {summary ? <FinalSummary summary={summary} /> : null}

                  {coverage && coverage.uncovered_comuni.length > 0 ? (
                    <div className="mt-4">
                      <h3 className="text-sm font-semibold text-ink">
                        Comuni non ancora coperti ({coverage.uncovered_comuni.length})
                      </h3>
                      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm text-muted">
                        {coverage.uncovered_comuni.map((c) => (
                          <li key={c.comune_id} className="flex justify-between gap-2">
                            <span>
                              {c.name} ({c.province})
                            </span>
                            <span className="tabular-nums text-xs">{c.pending_cells} celle</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!activeSearch?.auto_add_to_companies || filteredResults.some((r) => !r.added_company_id) ? (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={onlyPhone}
                        onChange={(e) => setOnlyPhone(e.target.checked)}
                        className="rounded border-line"
                      />
                      Solo con telefono
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={hideDiscarded}
                        onChange={(e) => setHideDiscarded(e.target.checked)}
                        className="rounded border-line"
                      />
                      Nascondi scartate
                    </label>
                    <p className="ml-auto text-sm text-muted">
                      <span className="font-semibold tabular-nums text-ink">{filteredResults.length}</span>{' '}
                      visibili · {selected.size} selezionate
                    </p>
                  </div>

                  {!activeSearch?.auto_add_to_companies ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={selected.size === 0 || addResults.isPending}
                        loading={addResults.isPending}
                        onClick={() => void addResults.mutateAsync([...selected])}
                      >
                        Aggiungi selezionate
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={selected.size === 0 || discardResults.isPending}
                        loading={discardResults.isPending}
                        onClick={() =>
                          void discardResults.mutateAsync({ ids: [...selected], discarded: true })
                        }
                      >
                        Scarta selezionate
                      </Button>
                      <Button variant="ghost" disabled={selectableIds.length === 0} onClick={togglePage}>
                        {selectableIds.every((id) => selected.has(id)) && selectableIds.length > 0
                          ? 'Deseleziona tutte'
                          : 'Seleziona tutte'}
                      </Button>
                    </div>
                  ) : null}

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
                  ) : filteredResults.length === 0 ? (
                    <EmptyState
                      title={running ? 'Ricerca in corso…' : 'Nessun risultato'}
                      description={
                        running
                          ? 'I primi risultati appariranno a breve.'
                          : 'Prova altre parole chiave o un’altra regione.'
                      }
                    />
                  ) : (
                    <ResultsTable
                      rows={filteredResults}
                      selected={selected}
                      onToggle={toggleRow}
                      onTogglePage={togglePage}
                      selectableIds={selectableIds}
                      selectable={!activeSearch?.auto_add_to_companies}
                    />
                  )}
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      <Modal
        open={confirmOpen}
        title="Conferma ricerca"
        description="Verrà fatta 1 richiesta Places per ogni comune, a lotti, fino al tetto impostato."
        onClose={() => !startSearch.isPending && setConfirmOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={startSearch.isPending}>
              Annulla
            </Button>
            <Button
              loading={startSearch.isPending}
              disabled={!estimate || overCap}
              onClick={() => void launchSearch()}
            >
              Conferma e avvia
            </Button>
          </>
        }
      >
        {estimateMutation.isPending && !estimate ? (
          <div className="flex justify-center py-8">
            <Spinner className="h-8 w-8 text-primary-600" />
          </div>
        ) : estimate ? (
          <div className="space-y-3 text-sm">
            <p>
              <span className="font-medium text-ink">{regions.join(', ')}</span>
              {provinces.length > 0 ? (
                <span className="text-muted"> · province {provinces.join(', ')}</span>
              ) : (
                <span className="text-muted"> · tutta la regione</span>
              )}
            </p>
            <p className="text-muted">Parole chiave: {keywords.join(', ')}</p>
            <p className="text-muted">
              Modalità: {autoAdd ? 'inserimento automatico in companies' : 'revisione manuale'}
            </p>
            <div
              className={`rounded-xl border px-3 py-3 ${
                overCap ? 'border-danger-dot/30 bg-danger-bg text-danger-fg' : 'border-line bg-canvas'
              }`}
            >
              <p>
                {estimate.comuni} comuni × {estimate.keywords} parole ={' '}
                <strong className="tabular-nums">{estimate.queries}</strong> richieste
              </p>
              <p className="mt-1">Costo indicativo: {formatEur(estimate.estimated_cost_eur)}</p>
              <p className="mt-1">Tetto confermato: {maxRequests}</p>
              {overCap ? (
                <p className="mt-2 font-medium">Bloccata: la stima supera il tetto massimo.</p>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">Impossibile calcolare la stima.</p>
        )}
      </Modal>

      <Modal
        open={cancelOpen}
        title="Annulla questo lotto"
        description="Elimina le aziende del lotto non ancora lavorate da collaboratori."
        onClose={() => !cancelBatch.isPending && setCancelOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelOpen(false)} disabled={cancelBatch.isPending}>
              Chiudi
            </Button>
            <Button
              variant="danger"
              loading={cancelBatch.isPending}
              disabled={!activeSearch?.import_batch_id}
              onClick={() => {
                if (!activeSearch?.import_batch_id) return
                void cancelBatch.mutateAsync(activeSearch.import_batch_id).then(() => setCancelOpen(false))
              }}
            >
              Conferma annullamento
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Vengono eliminate solo le aziende senza assegnazione e senza log di chiamata. Le altre
          restano e vengono segnalate nel riepilogo.
        </p>
      </Modal>
    </section>
  )
}

function CoverageCards({
  coverage,
  job,
  activeSearch,
  usedCost,
}: {
  coverage: ReturnType<typeof useSearchCoverage>['data']
  job: ReturnType<typeof useSearchJob>['data']
  activeSearch: PlacesSearch
  usedCost: number
}) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-line bg-canvas px-3 py-2.5">
        <p className="text-xs text-muted">Comuni</p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink">
          {coverage?.comuni_done ?? job?.comuni_done ?? 0}/
          {coverage?.comuni_total ?? job?.comuni_total ?? '—'}
        </p>
      </div>
      <div className="rounded-xl border border-line bg-canvas px-3 py-2.5">
        <p className="text-xs text-muted">Celle sature</p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink">
          {coverage?.cells_saturo ?? job?.saturated_cells ?? 0}
        </p>
      </div>
      <div className="rounded-xl border border-line bg-canvas px-3 py-2.5">
        <p className="text-xs text-muted">Richieste</p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink">
          {activeSearch.actual_requests}/{activeSearch.max_requests}
        </p>
      </div>
      <div className="rounded-xl border border-line bg-canvas px-3 py-2.5">
        <p className="text-xs text-muted">Costo stimato</p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink">{formatEur(usedCost)}</p>
      </div>
    </div>
  )
}

function FinalSummary({ summary }: { summary: BatchSummary }) {
  return (
    <div className="mt-4 rounded-xl border border-success-dot/25 bg-success-bg/40 px-4 py-3">
      <h3 className="text-sm font-semibold text-ink">Riepilogo lotto</h3>
      <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Comuni</dt>
          <dd className="font-medium tabular-nums text-ink">
            {summary.comuni_done}/{summary.comuni_total}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Trovate</dt>
          <dd className="font-medium tabular-nums text-ink">{summary.found}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Nuove inserite</dt>
          <dd className="font-medium tabular-nums text-ink">{summary.inserted}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Doppioni scartati</dt>
          <dd className="font-medium tabular-nums text-ink">{summary.duplicates_safe}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Dubbi</dt>
          <dd className="font-medium tabular-nums text-ink">{summary.duplicates_doubtful}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Senza telefono</dt>
          <dd className="font-medium tabular-nums text-ink">{summary.without_phone}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Richieste</dt>
          <dd className="font-medium tabular-nums text-ink">{summary.requests}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Costo stimato</dt>
          <dd className="font-medium tabular-nums text-ink">{formatEur(summary.estimated_cost_eur)}</dd>
        </div>
      </dl>
    </div>
  )
}

function ResultsTable({
  rows,
  selected,
  onToggle,
  onTogglePage,
  selectableIds,
  selectable,
}: {
  rows: SearchResultRow[]
  selected: Set<string>
  onToggle: (id: string) => void
  onTogglePage: () => void
  selectableIds: string[]
  selectable: boolean
}) {
  const allOn = selectable && selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-line bg-canvas/80 text-xs uppercase tracking-wide text-muted">
          <tr>
            {selectable ? (
              <th className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={allOn}
                  onChange={onTogglePage}
                  disabled={selectableIds.length === 0}
                  aria-label="Seleziona tutte"
                />
              </th>
            ) : null}
            <th className="px-3 py-3 font-medium">Azienda</th>
            <th className="px-3 py-3 font-medium">Telefono</th>
            <th className="hidden px-3 py-3 font-medium md:table-cell">Città</th>
            <th className="px-3 py-3 font-medium">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const canSelect =
              selectable && !row.discarded && !row.added_company_id && !row.is_duplicate_in_db
            return (
              <tr
                key={row.id}
                className={`border-b border-line/70 last:border-0 ${row.discarded ? 'opacity-50' : ''} ${
                  row.added_company_id ? 'bg-success-bg/40' : ''
                }`}
              >
                {selectable ? (
                  <td className="px-3 py-3 align-top">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      disabled={!canSelect}
                      onChange={() => onToggle(row.id)}
                      aria-label={`Seleziona ${row.name}`}
                    />
                  </td>
                ) : null}
                <td className="px-3 py-3 align-top">
                  <p className="font-medium text-ink">{row.name}</p>
                  {row.address ? (
                    <p className="mt-0.5 max-w-xs text-xs text-muted line-clamp-2">{row.address}</p>
                  ) : null}
                </td>
                <td className="px-3 py-3 align-top tabular-nums text-ink">
                  {row.phone || <span className="text-muted">—</span>}
                </td>
                <td className="hidden px-3 py-3 align-top text-muted md:table-cell">
                  {row.city}
                  {row.province ? ` (${row.province})` : ''}
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-wrap gap-1">
                    {row.is_duplicate_in_db ? <Badge variant="warning">Doppione sicuro</Badge> : null}
                    {row.possible_duplicate ? (
                      <Badge variant="violet">
                        {row.similar_company_id ? (
                          <Link to={`/aziende?q=${encodeURIComponent(row.name)}`} className="underline">
                            Possibile doppione
                          </Link>
                        ) : (
                          'Possibile doppione'
                        )}
                      </Badge>
                    ) : null}
                    {row.added_company_id ? <Badge variant="success">Aggiunta</Badge> : null}
                    {row.discarded ? <Badge variant="quiet">Scartata</Badge> : null}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
