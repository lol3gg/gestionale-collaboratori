import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  GooglePlacesProvider,
  PlacesAuthError,
  PlacesNetworkError,
  PlacesQuotaError,
  splitBBoxIntoQuadrants,
} from './providers/googlePlaces.ts'
import type { BBox, NormalizedPlace, SearchProvider } from './providers/types.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BATCH_SIZE = 5
const MAX_DEPTH = 4
const REGION_CODES: Record<string, string> = {
  IT: 'IT',
  CH: 'CH',
  FR: 'FR',
  DE: 'DE',
  AT: 'AT',
  ES: 'ES',
}

type StartBody = {
  action: 'start'
  country: string
  /** Una o più regioni: tutti i comuni di ciascuna. */
  regions: string[]
  /** Opzionale: se vuoto, prende tutti i comuni delle regioni. */
  provinces: string[]
  keywords: string[]
  max_requests: number
  estimated_queries: number
  estimated_cost_eur: number
  auto_add: boolean
  name?: string
}

type ProcessBody = { action: 'process'; search_id: string }
type PauseBody = { action: 'pause'; search_id: string }
type ResumeBody = { action: 'resume'; search_id: string }
type ActionBody = StartBody | ProcessBody | PauseBody | ResumeBody

type ComuneRow = {
  id: string
  name: string
  province: string
  region: string
  country: string
  population: number | null
  bbox_sw_lat: number
  bbox_sw_lng: number
  bbox_ne_lat: number
  bbox_ne_lng: number
}

type CellRow = {
  id: string
  job_id: string
  search_id: string
  comune_id: string
  keyword: string
  level: number
  bbox_sw_lat: number
  bbox_sw_lng: number
  bbox_ne_lat: number
  bbox_ne_lng: number
  status: string
  n_risultati: number
  n_nuovi: number
  comuni?: { name: string; province: string; region: string; country: string; population: number | null } | null
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' ? value : null
}

function readNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readStringArray(record: Record<string, unknown>, key: string): string[] | null {
  const value = record[key]
  if (!Array.isArray(value)) return null
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') return null
    const trimmed = item.trim()
    if (trimmed) out.push(trimmed)
  }
  return out
}

function parseBody(raw: unknown): { ok: true; value: ActionBody } | { ok: false; error: string } {
  if (!isRecord(raw)) return { ok: false, error: 'Richiesta non valida' }
  const action = readString(raw, 'action')

  if (action === 'start') {
    const country = (readString(raw, 'country') ?? 'IT').trim().toUpperCase()
    let regions = readStringArray(raw, 'regions')
    const singleRegion = (readString(raw, 'region') ?? '').trim()
    if ((!regions || regions.length === 0) && singleRegion) regions = [singleRegion]
    const provinces = readStringArray(raw, 'provinces') ?? []
    const keywords = readStringArray(raw, 'keywords')
    const maxRequests = readNumber(raw, 'max_requests')
    const estimatedQueries = readNumber(raw, 'estimated_queries')
    const estimatedCost = readNumber(raw, 'estimated_cost_eur')
    const name = readString(raw, 'name')?.trim()
    const autoAdd = raw.auto_add === true

    if (!regions || regions.length === 0) return { ok: false, error: 'Seleziona almeno una regione' }
    if (!keywords || keywords.length === 0) return { ok: false, error: 'Inserisci almeno una parola chiave' }
    if (maxRequests === null || maxRequests < 1) {
      return { ok: false, error: 'Imposta un tetto massimo di richieste valido' }
    }
    if (estimatedQueries === null || estimatedQueries < 1) {
      return { ok: false, error: 'Stima richieste non valida' }
    }
    if (estimatedQueries > maxRequests) {
      return {
        ok: false,
        error: `La stima (${estimatedQueries} richieste) supera il tetto massimo (${maxRequests}). Riduci regioni/parole chiave o alza il tetto.`,
      }
    }

    return {
      ok: true,
      value: {
        action: 'start',
        country,
        regions,
        provinces: provinces.map((p) => p.toUpperCase()),
        keywords,
        max_requests: Math.floor(maxRequests),
        estimated_queries: Math.floor(estimatedQueries),
        estimated_cost_eur: estimatedCost ?? 0,
        auto_add: autoAdd,
        name: name || undefined,
      },
    }
  }

  if (action === 'process' || action === 'pause' || action === 'resume') {
    const searchId = readString(raw, 'search_id')
    if (!searchId) return { ok: false, error: 'search_id mancante' }
    return { ok: true, value: { action, search_id: searchId } }
  }

  return { ok: false, error: 'Azione non supportata' }
}

function todayRome(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date())
}

async function getSettingNumber(admin: SupabaseClient, key: string, fallback: number): Promise<number> {
  const { data } = await admin.from('app_settings').select('value').eq('key', key).maybeSingle()
  if (!data || !isRecord(data)) return fallback
  const value = data.value
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }
  if (value !== null && value !== undefined) {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

async function ensureDailyQuota(
  admin: SupabaseClient,
  needed: number,
): Promise<{ ok: true } | { ok: false; error: string; used: number; limit: number }> {
  const limit = await getSettingNumber(admin, 'places_daily_request_limit', 500)
  const day = todayRome()
  const { data: row } = await admin.from('places_usage_daily').select('request_count').eq('day', day).maybeSingle()
  const used = typeof row?.request_count === 'number' ? row.request_count : 0
  if (used + needed > limit) {
    return {
      ok: false,
      used,
      limit,
      error: `Limite giornaliero richieste raggiunto (${used}/${limit}).`,
    }
  }
  return { ok: true }
}

async function bumpDailyUsage(admin: SupabaseClient, delta: number): Promise<void> {
  if (delta <= 0) return
  const day = todayRome()
  const { data: row } = await admin.from('places_usage_daily').select('request_count').eq('day', day).maybeSingle()
  if (row) {
    await admin
      .from('places_usage_daily')
      .update({ request_count: (row.request_count ?? 0) + delta, updated_at: new Date().toISOString() })
      .eq('day', day)
  } else {
    await admin.from('places_usage_daily').insert({ day, request_count: delta })
  }
}

function searchName(regions: string[], provinces: string[], keywords: string[]): string {
  const kw = keywords.slice(0, 2).join(', ')
  const more = keywords.length > 2 ? ` +${keywords.length - 2}` : ''
  const area = provinces.length > 0 ? `${regions.join(', ')} · ${provinces.join(',')}` : regions.join(', ')
  return `${area} · ${kw}${more}`.slice(0, 120)
}

async function finalizeBatchIfAny(admin: SupabaseClient, searchId: string): Promise<Record<string, unknown> | null> {
  const { data: search } = await admin
    .from('searches')
    .select('import_batch_id')
    .eq('id', searchId)
    .maybeSingle()
  const batchId = search?.import_batch_id as string | null
  if (!batchId) return null
  const { data, error } = await admin.rpc('finalize_import_batch', { p_batch_id: batchId })
  if (error) {
    console.error('search-companies: finalize batch fallito', error.message)
    return null
  }
  return isRecord(data) ? data : null
}

function cellBBox(cell: CellRow): BBox {
  return {
    swLat: cell.bbox_sw_lat,
    swLng: cell.bbox_sw_lng,
    neLat: cell.bbox_ne_lat,
    neLng: cell.bbox_ne_lng,
  }
}

async function loadExistingCompanyKeys(admin: SupabaseClient): Promise<{
  placeIds: Set<string>
  phones: Set<string>
}> {
  const placeIds = new Set<string>()
  const phones = new Set<string>()

  const { data: places } = await admin
    .from('companies')
    .select('google_place_id')
    .not('google_place_id', 'is', null)
  for (const row of places ?? []) {
    if (typeof row.google_place_id === 'string' && row.google_place_id) placeIds.add(row.google_place_id)
  }

  const { data: phoneRows } = await admin.from('companies').select('phone').neq('phone', '')
  for (const row of phoneRows ?? []) {
    if (typeof row.phone !== 'string' || !row.phone) continue
    const digits = row.phone.replace(/\D/g, '')
    if (!digits) continue
    phones.add(digits)
    if (digits.startsWith('39')) phones.add(digits.slice(2))
    else phones.add(`39${digits}`)
  }

  return { placeIds, phones }
}

function phoneMatches(normalized: string, phones: Set<string>): boolean {
  if (!normalized) return false
  const digits = normalized.replace(/\D/g, '')
  if (!digits) return false
  if (phones.has(digits)) return true
  if (digits.startsWith('39') && phones.has(digits.slice(2))) return true
  if (phones.has(`39${digits}`)) return true
  return false
}

async function loadSeenPlaceIds(admin: SupabaseClient, searchId: string): Promise<Set<string>> {
  const seen = new Set<string>()
  const { data } = await admin
    .from('search_results')
    .select('google_place_id')
    .eq('search_id', searchId)
    .not('google_place_id', 'is', null)
  for (const row of data ?? []) {
    if (typeof row.google_place_id === 'string' && row.google_place_id) seen.add(row.google_place_id)
  }
  return seen
}

/** Inserisce solo place_id nuovi; ritorna quanti nuovi univoci e gli id inseriti. */
async function insertNewResults(
  admin: SupabaseClient,
  searchId: string,
  places: NormalizedPlace[],
  companyKeys: { placeIds: Set<string>; phones: Set<string> },
  seenPlaceIds: Set<string>,
): Promise<{ inserted: number; newUnique: number; resultIds: string[]; safeDupes: number }> {
  if (places.length === 0) return { inserted: 0, newUnique: 0, resultIds: [], safeDupes: 0 }

  const rows = []
  const now = new Date().toISOString()
  let newUnique = 0
  let safeDupes = 0

  for (const place of places) {
    const isDupSearch = Boolean(place.google_place_id && seenPlaceIds.has(place.google_place_id))
    if (place.google_place_id && !isDupSearch) {
      seenPlaceIds.add(place.google_place_id)
      newUnique += 1
    }

    const dupDb =
      (place.google_place_id && companyKeys.placeIds.has(place.google_place_id)) ||
      phoneMatches(place.phone_normalized, companyKeys.phones)

    if (isDupSearch) continue
    if (dupDb) safeDupes += 1

    rows.push({
      search_id: searchId,
      google_place_id: place.google_place_id || null,
      name: place.name,
      phone: place.phone,
      phone_normalized: place.phone_normalized,
      website: place.website,
      address: place.address,
      city: place.city,
      province: place.province,
      region: place.region,
      country: place.country,
      business_status: place.business_status,
      is_duplicate_in_db: Boolean(dupDb),
      is_duplicate_in_search: false,
      fetched_at: now,
    })
  }

  if (rows.length === 0) return { inserted: 0, newUnique: 0, resultIds: [], safeDupes: 0 }

  const { data, error } = await admin.from('search_results').insert(rows).select('id, is_duplicate_in_db')
  if (error) throw new Error(`Salvataggio risultati fallito: ${error.message}`)
  const resultIds = (data ?? [])
    .filter((r) => !r.is_duplicate_in_db)
    .map((r) => r.id as string)
  return { inserted: rows.length, newUnique, resultIds, safeDupes }
}

async function autoIngestResults(
  admin: SupabaseClient,
  resultIds: string[],
  batchId: string | null,
): Promise<void> {
  if (!batchId || resultIds.length === 0) return
  const { error } = await admin.rpc('ingest_search_results_to_companies', {
    p_ids: resultIds,
    p_batch_id: batchId,
  })
  if (error) {
    console.error('search-companies: auto-ingest fallito', error.message)
  }
}

async function refreshJobCoverage(admin: SupabaseClient, jobId: string, searchId: string): Promise<{
  pending: number
  saturated: number
  comuniTotal: number
  comuniDone: number
  resultsCount: number
}> {
  const { count: pending } = await admin
    .from('search_cells')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .eq('status', 'da_fare')

  const { count: saturated } = await admin
    .from('search_cells')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .eq('status', 'saturo')

  const { data: level0 } = await admin
    .from('search_cells')
    .select('comune_id')
    .eq('job_id', jobId)
    .eq('level', 0)
  const comuniIds = [...new Set((level0 ?? []).map((r) => r.comune_id as string))]
  const comuniTotal = comuniIds.length

  let comuniDone = 0
  if (comuniIds.length > 0) {
    const { data: pendingByComune } = await admin
      .from('search_cells')
      .select('comune_id')
      .eq('job_id', jobId)
      .eq('status', 'da_fare')
    const pendingSet = new Set((pendingByComune ?? []).map((r) => r.comune_id as string))
    comuniDone = comuniIds.filter((id) => !pendingSet.has(id)).length
  }

  const { count: resultsCount } = await admin
    .from('search_results')
    .select('id', { count: 'exact', head: true })
    .eq('search_id', searchId)

  await admin
    .from('search_jobs')
    .update({
      pending_cells: pending ?? 0,
      saturated_cells: saturated ?? 0,
      comuni_total: comuniTotal,
      comuni_done: comuniDone,
      completed_queries: comuniDone,
      total_queries: comuniTotal,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)

  await admin
    .from('searches')
    .update({ results_count: resultsCount ?? 0 })
    .eq('id', searchId)

  return {
    pending: pending ?? 0,
    saturated: saturated ?? 0,
    comuniTotal,
    comuniDone,
    resultsCount: resultsCount ?? 0,
  }
}

async function buildPauseSummary(admin: SupabaseClient, jobId: string, reason: string): Promise<string> {
  const { count: pending } = await admin
    .from('search_cells')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .eq('status', 'da_fare')
  const { data: uncovered } = await admin
    .from('search_cells')
    .select('comune_id, comuni(name)')
    .eq('job_id', jobId)
    .eq('status', 'da_fare')
  const names = [
    ...new Set(
      (uncovered ?? [])
        .map((r) => {
          const c = r.comuni as { name?: string } | { name?: string }[] | null
          if (Array.isArray(c)) return c[0]?.name
          return c?.name
        })
        .filter((n): n is string => Boolean(n)),
    ),
  ]
  const sample = names.slice(0, 8).join(', ')
  const more = names.length > 8 ? ` (+${names.length - 8})` : ''
  return `${reason} Mancano ${pending ?? 0} celle. Comuni scoperti: ${names.length}${sample ? ` — ${sample}${more}` : ''}.`
}

async function createInitialCells(
  admin: SupabaseClient,
  jobId: string,
  searchId: string,
  comuni: ComuneRow[],
  keywords: string[],
): Promise<number> {
  // Ordina comuni più piccoli prima
  const sorted = [...comuni].sort((a, b) => {
    const pa = a.population ?? 9_999_999
    const pb = b.population ?? 9_999_999
    if (pa !== pb) return pa - pb
    return a.name.localeCompare(b.name, 'it')
  })

  const rows = []
  for (const comune of sorted) {
    if (
      comune.bbox_sw_lat == null ||
      comune.bbox_sw_lng == null ||
      comune.bbox_ne_lat == null ||
      comune.bbox_ne_lng == null
    ) {
      continue
    }
    for (const keyword of keywords) {
      rows.push({
        job_id: jobId,
        search_id: searchId,
        comune_id: comune.id,
        keyword,
        level: 0,
        bbox_sw_lat: comune.bbox_sw_lat,
        bbox_sw_lng: comune.bbox_sw_lng,
        bbox_ne_lat: comune.bbox_ne_lat,
        bbox_ne_lng: comune.bbox_ne_lng,
        status: 'da_fare',
      })
    }
  }

  if (rows.length === 0) return 0

  // Insert in chunks
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200)
    const { error } = await admin.from('search_cells').insert(chunk)
    if (error) throw new Error(`Creazione celle fallita: ${error.message}`)
  }
  return rows.length
}

async function processBatch(
  admin: SupabaseClient,
  provider: SearchProvider,
  searchId: string,
  jobId: string,
): Promise<Response> {
  const { data: search, error: searchErr } = await admin
    .from('searches')
    .select(
      'id, country, region, regions, provinces, keywords, max_requests, actual_requests, results_count, status, auto_add_to_companies, import_batch_id',
    )
    .eq('id', searchId)
    .maybeSingle()
  if (searchErr || !search) return json({ error: 'Ricerca non trovata' }, 404)

  const autoAdd = Boolean(search.auto_add_to_companies)
  const batchId = (search.import_batch_id as string | null) ?? null

  const { data: job, error: jobErr } = await admin.from('search_jobs').select('*').eq('id', jobId).maybeSingle()
  if (jobErr || !job) return json({ error: 'Job non trovato' }, 404)

  if (['completed', 'failed', 'cancelled', 'paused'].includes(job.status as string)) {
    return json({
      ok: true,
      search_id: searchId,
      job_status: job.status,
      done: job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled',
      paused: job.status === 'paused' || job.status === 'paused_limit',
    })
  }

  // paused_limit can be resumed via resume action; process alone shouldn't continue
  if (job.status === 'paused_limit') {
    return json({
      ok: true,
      search_id: searchId,
      job_status: 'paused_limit',
      done: false,
      paused: true,
      error: job.pause_summary ?? job.error_message,
    })
  }

  const country = (search.country as string) || 'IT'
  const regionCode = REGION_CODES[country] ?? 'IT'
  const maxRequests = search.max_requests as number
  let searchRequests = search.actual_requests as number
  let resultsCount = search.results_count as number

  await admin.from('search_jobs').update({ status: 'running', updated_at: new Date().toISOString() }).eq('id', jobId)
  await admin.from('searches').update({ status: 'running' }).eq('id', searchId)

  // Prendi N celle da_fare: comuni piccoli prima (via join population), livello basso prima
  const { data: pendingCells, error: cellsErr } = await admin
    .from('search_cells')
    .select(
      'id, job_id, search_id, comune_id, keyword, level, bbox_sw_lat, bbox_sw_lng, bbox_ne_lat, bbox_ne_lng, status, n_risultati, n_nuovi, comuni(name, province, region, country, population)',
    )
    .eq('job_id', jobId)
    .eq('status', 'da_fare')
    .order('level', { ascending: true })
    .limit(BATCH_SIZE * 3)

  if (cellsErr) return json({ error: 'Impossibile caricare le celle' }, 500)

  const cells = ((pendingCells ?? []) as unknown as CellRow[]).sort((a, b) => {
    const pa = a.comuni?.population ?? 9_999_999
    const pb = b.comuni?.population ?? 9_999_999
    if (pa !== pb) return pa - pb
    if (a.level !== b.level) return a.level - b.level
    return a.keyword.localeCompare(b.keyword)
  }).slice(0, BATCH_SIZE)

  if (cells.length === 0) {
    const cov = await refreshJobCoverage(admin, jobId, searchId)
    await admin
      .from('search_jobs')
      .update({
        status: 'completed',
        pause_summary: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
    await admin
      .from('searches')
      .update({
        status: 'completed',
        actual_requests: searchRequests,
        results_count: cov.resultsCount,
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', searchId)

    const summary = await finalizeBatchIfAny(admin, searchId)

    return json({
      ok: true,
      search_id: searchId,
      job_status: 'completed',
      done: true,
      request_count: searchRequests,
      results_count: cov.resultsCount,
      comuni_done: cov.comuniDone,
      comuni_total: cov.comuniTotal,
      cells_pending: 0,
      cells_saturo: cov.saturated,
      summary: summary ?? undefined,
    })
  }

  const companyKeys = await loadExistingCompanyKeys(admin)
  const seenPlaceIds = await loadSeenPlaceIds(admin, searchId)
  let batchRequests = 0
  let pauseReason: string | null = null

  for (const cell of cells) {
    if (searchRequests + batchRequests >= maxRequests) {
      pauseReason = `Tetto job di ${maxRequests} richieste raggiunto.`
      break
    }

    const daily = await ensureDailyQuota(admin, 1)
    if (!daily.ok) {
      pauseReason = daily.error
      break
    }

    const comuneName = cell.comuni?.name ?? ''
    const textQuery = cell.keyword
    const bbox = cellBBox(cell)

    try {
      const { places, requestCount: used, saturated } = await provider.search(textQuery, {
        languageCode: 'it',
        regionCode,
        maxPages: 3,
        locationRestriction: bbox,
        locationHint: {
          city: comuneName,
          province: cell.comuni?.province ?? '',
          region: cell.comuni?.region ?? '',
          country: cell.comuni?.country || country,
        },
      })

      batchRequests += used
      await bumpDailyUsage(admin, used)

      const { inserted, newUnique, resultIds } = await insertNewResults(
        admin,
        searchId,
        places,
        companyKeys,
        seenPlaceIds,
      )
      resultsCount += inserted

      if (autoAdd && resultIds.length > 0) {
        await autoIngestResults(admin, resultIds, batchId)
        // Aggiorna chiavi companies per dedupe successivo nello stesso batch
        for (const place of places) {
          if (place.google_place_id) companyKeys.placeIds.add(place.google_place_id)
          if (place.phone_normalized) {
            const d = place.phone_normalized.replace(/\D/g, '')
            if (d) {
              companyKeys.phones.add(d)
              if (!d.startsWith('39')) companyKeys.phones.add(`39${d}`)
            }
          }
        }
      }

      let newStatus = 'fatto'
      const childRows: Record<string, unknown>[] = []

      if (saturated && newUnique > 0) {
        if (cell.level >= MAX_DEPTH) {
          newStatus = 'da_verificare_manualmente'
        } else {
          newStatus = 'saturo'
          const quads = splitBBoxIntoQuadrants(bbox)
          for (const q of quads) {
            childRows.push({
              job_id: jobId,
              search_id: searchId,
              comune_id: cell.comune_id,
              keyword: cell.keyword,
              level: cell.level + 1,
              bbox_sw_lat: q.swLat,
              bbox_sw_lng: q.swLng,
              bbox_ne_lat: q.neLat,
              bbox_ne_lng: q.neLng,
              status: 'da_fare',
              parent_cell_id: cell.id,
            })
          }
        }
      } else if (saturated && newUnique === 0) {
        // Saturo ma nessun risultato nuovo → non dividere
        newStatus = 'fatto'
      }

      await admin
        .from('search_cells')
        .update({
          status: newStatus,
          n_risultati: places.length,
          n_nuovi: newUnique,
          request_count: used,
          processed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('id', cell.id)

      if (childRows.length > 0) {
        const { error: childErr } = await admin.from('search_cells').insert(childRows)
        if (childErr) {
          console.error('search-companies: insert quadranti fallito', childErr.message)
        }
      }
    } catch (err) {
      const message =
        err instanceof PlacesQuotaError || err instanceof PlacesAuthError || err instanceof PlacesNetworkError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Errore sconosciuto'

      await admin
        .from('search_cells')
        .update({
          status: 'errore',
          error_message: message,
          processed_at: new Date().toISOString(),
        })
        .eq('id', cell.id)

      // Errori auth/quota: pausa job
      if (err instanceof PlacesQuotaError || err instanceof PlacesAuthError) {
        const summary = await buildPauseSummary(admin, jobId, message)
        await admin
          .from('search_jobs')
          .update({
            status: 'paused_limit',
            request_count: (job.request_count as number) + batchRequests,
            error_message: message,
            last_error: message,
            pause_summary: summary,
            updated_at: new Date().toISOString(),
          })
          .eq('id', jobId)
        await admin
          .from('searches')
          .update({
            status: 'paused_limit',
            actual_requests: searchRequests + batchRequests,
            results_count: resultsCount,
            error_message: summary,
          })
          .eq('id', searchId)

        return json({
          ok: false,
          error: summary,
          search_id: searchId,
          job_status: 'paused_limit',
          done: false,
          paused: true,
        })
      }
      // Altri errori: marca cella e continua
    }
  }

  searchRequests += batchRequests
  const cov = await refreshJobCoverage(admin, jobId, searchId)

  await admin
    .from('search_jobs')
    .update({
      request_count: (job.request_count as number) + batchRequests,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)

  if (pauseReason) {
    const summary = `${pauseReason} Completati ${cov.comuniDone}/${cov.comuniTotal} comuni. Celle pendenti: ${cov.pending}. Celle sature: ${cov.saturated}.`
    await admin
      .from('search_jobs')
      .update({
        status: 'paused_limit',
        error_message: pauseReason,
        pause_summary: summary,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
    await admin
      .from('searches')
      .update({
        status: 'paused_limit',
        actual_requests: searchRequests,
        results_count: cov.resultsCount,
        error_message: summary,
      })
      .eq('id', searchId)

    return json({
      ok: true,
      search_id: searchId,
      job_status: 'paused_limit',
      done: false,
      paused: true,
      error: summary,
      request_count: searchRequests,
      results_count: cov.resultsCount,
      comuni_done: cov.comuniDone,
      comuni_total: cov.comuniTotal,
      cells_pending: cov.pending,
      cells_saturo: cov.saturated,
    })
  }

  if (cov.pending === 0) {
    await admin
      .from('search_jobs')
      .update({
        status: 'completed',
        pause_summary: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
    await admin
      .from('searches')
      .update({
        status: 'completed',
        actual_requests: searchRequests,
        results_count: cov.resultsCount,
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', searchId)

    const summary = await finalizeBatchIfAny(admin, searchId)

    return json({
      ok: true,
      search_id: searchId,
      job_status: 'completed',
      done: true,
      request_count: searchRequests,
      results_count: cov.resultsCount,
      comuni_done: cov.comuniDone,
      comuni_total: cov.comuniTotal,
      cells_pending: 0,
      cells_saturo: cov.saturated,
      summary: summary ?? undefined,
    })
  }

  await admin.from('searches').update({ actual_requests: searchRequests, results_count: cov.resultsCount }).eq('id', searchId)

  return json({
    ok: true,
    search_id: searchId,
    job_status: 'running',
    done: false,
    request_count: searchRequests,
    results_count: cov.resultsCount,
    comuni_done: cov.comuniDone,
    comuni_total: cov.comuniTotal,
    cells_pending: cov.pending,
    cells_saturo: cov.saturated,
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const placesKey = Deno.env.get('GOOGLE_PLACES_API_KEY')

    if (!supabaseUrl || !serviceKey || !anonKey) {
      return json({ error: 'Configurazione del server incompleta' }, 500)
    }
    if (!placesKey) {
      return json({ error: 'Chiave Google Places non configurata sul server' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Non autenticato' }, 401)
    const token = authHeader.slice('Bearer '.length).trim()
    if (!token) return json({ error: 'Non autenticato' }, 401)

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: userData, error: userError } = await authClient.auth.getUser(token)
    if (userError || !userData.user) return json({ error: 'Non autenticato' }, 401)
    const callerId = userData.user.id

    const { data: callerRow, error: callerError } = await admin
      .from('profiles')
      .select('role, active')
      .eq('id', callerId)
      .maybeSingle()
    if (callerError) {
      console.error('search-companies: lettura profilo fallita')
      return json({ error: 'Errore imprevisto. Riprova.' }, 500)
    }
    if (!callerRow || callerRow.role !== 'admin' || !callerRow.active) {
      return json({ error: 'Operazione riservata agli amministratori attivi' }, 403)
    }

    let payload: unknown
    try {
      payload = await req.json()
    } catch {
      return json({ error: 'Richiesta non valida' }, 400)
    }
    const parsed = parseBody(payload)
    if (!parsed.ok) return json({ error: parsed.error }, 400)

    const provider: SearchProvider = new GooglePlacesProvider(placesKey)

    if (parsed.value.action === 'pause') {
      const searchId = parsed.value.search_id
      const { data: job } = await admin.from('search_jobs').select('id, status').eq('search_id', searchId).maybeSingle()
      if (!job) return json({ error: 'Job non trovato' }, 404)
      if (job.status !== 'running' && job.status !== 'queued') {
        return json({ ok: true, search_id: searchId, job_status: job.status, paused: true })
      }
      await admin
        .from('search_jobs')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', job.id)
      await admin.from('searches').update({ status: 'paused' }).eq('id', searchId)
      return json({ ok: true, search_id: searchId, job_status: 'paused', paused: true, done: false })
    }

    if (parsed.value.action === 'resume') {
      const searchId = parsed.value.search_id
      const { data: job } = await admin.from('search_jobs').select('id, status').eq('search_id', searchId).maybeSingle()
      if (!job) return json({ error: 'Job non trovato' }, 404)
      if (job.status !== 'paused' && job.status !== 'paused_limit') {
        return json({ error: 'Il job non è in pausa' }, 400)
      }
      await admin
        .from('search_jobs')
        .update({
          status: 'queued',
          pause_summary: null,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
      await admin
        .from('searches')
        .update({ status: 'queued', error_message: null })
        .eq('id', searchId)
      return await processBatch(admin, provider, searchId, job.id)
    }

    if (parsed.value.action === 'start') {
      const input = parsed.value

      const quota = await ensureDailyQuota(admin, 1)
      if (!quota.ok) return json({ error: quota.error }, 429)

      let comuniQuery = admin
        .from('comuni')
        .select(
          'id, name, province, region, country, population, bbox_sw_lat, bbox_sw_lng, bbox_ne_lat, bbox_ne_lng',
        )
        .in('region', input.regions)
        .not('bbox_sw_lat', 'is', null)
        .order('population', { ascending: true, nullsFirst: false })

      if (input.provinces.length > 0) {
        comuniQuery = comuniQuery.in('province', input.provinces)
      }

      const { data: comuni, error: comuniErr } = await comuniQuery

      if (comuniErr) return json({ error: 'Impossibile caricare i comuni' }, 500)
      const comuniRows = (comuni ?? []) as ComuneRow[]
      if (comuniRows.length === 0) {
        return json({
          error: 'Nessun comune con bounding box per le regioni scelte. Carica il seed OSM/ISTAT.',
        }, 400)
      }

      const cellEstimate = comuniRows.length * input.keywords.length
      if (cellEstimate > input.max_requests) {
        return json({
          error: `Servono almeno ${cellEstimate} celle (comuni×keyword) ma il tetto è ${input.max_requests}. Alza il tetto o riduci le regioni.`,
        }, 400)
      }

      const name = input.name ?? searchName(input.regions, input.provinces, input.keywords)

      // Crea lotto import
      const { data: batchRow, error: batchErr } = await admin
        .from('import_batches')
        .insert({
          created_by: callerId,
          country: input.country,
          regions: input.regions,
          keywords: input.keywords,
          max_requests: input.max_requests,
          auto_add: input.auto_add,
          comuni_total: comuniRows.length,
          estimated_cost_eur: input.estimated_cost_eur,
          status: 'active',
        })
        .select('id')
        .single()
      if (batchErr || !batchRow) {
        console.error('search-companies: insert batch fallito')
        return json({ error: 'Impossibile creare il lotto di import' }, 500)
      }

      const { data: searchRow, error: insertErr } = await admin
        .from('searches')
        .insert({
          user_id: callerId,
          name,
          query: input.keywords.join(', '),
          country: input.country,
          region: input.regions[0] ?? null,
          regions: input.regions,
          province: input.provinces[0] ?? null,
          provinces: input.provinces,
          keywords: input.keywords,
          max_requests: input.max_requests,
          estimated_queries: input.estimated_queries,
          estimated_cost_eur: input.estimated_cost_eur,
          auto_add_to_companies: input.auto_add,
          import_batch_id: batchRow.id,
          status: 'queued',
        })
        .select('id')
        .single()
      if (insertErr || !searchRow) {
        console.error('search-companies: insert search fallito')
        await admin.from('import_batches').delete().eq('id', batchRow.id)
        return json({ error: 'Impossibile creare la ricerca' }, 500)
      }

      await admin.from('import_batches').update({ search_id: searchRow.id }).eq('id', batchRow.id)

      const { data: jobRow, error: jobErr } = await admin
        .from('search_jobs')
        .insert({
          search_id: searchRow.id,
          status: 'queued',
          total_queries: comuniRows.length,
          comuni_total: comuniRows.length,
          batch_size: BATCH_SIZE,
        })
        .select('id')
        .single()
      if (jobErr || !jobRow) {
        console.error('search-companies: insert job fallito')
        await admin
          .from('searches')
          .update({ status: 'failed', error_message: 'Creazione job fallita' })
          .eq('id', searchRow.id)
        return json({ error: 'Impossibile creare il job di ricerca' }, 500)
      }

      try {
        const nCells = await createInitialCells(admin, jobRow.id, searchRow.id, comuniRows, input.keywords)
        if (nCells === 0) {
          await admin
            .from('searches')
            .update({ status: 'failed', error_message: 'Nessuna cella creata (bbox mancanti)' })
            .eq('id', searchRow.id)
          return json({ error: 'Nessuna cella creata: comuni senza bbox' }, 400)
        }
        await admin
          .from('search_jobs')
          .update({ pending_cells: nCells, updated_at: new Date().toISOString() })
          .eq('id', jobRow.id)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Creazione celle fallita'
        await admin.from('searches').update({ status: 'failed', error_message: msg }).eq('id', searchRow.id)
        return json({ error: msg }, 500)
      }

      return await processBatch(admin, provider, searchRow.id, jobRow.id)
    }

    // process
    const searchId = parsed.value.search_id
    const { data: job } = await admin.from('search_jobs').select('id, status').eq('search_id', searchId).maybeSingle()
    if (!job) return json({ error: 'Job non trovato per questa ricerca' }, 404)
    return await processBatch(admin, provider, searchId, job.id)
  } catch (err) {
    console.error('search-companies: errore imprevisto', err instanceof Error ? err.message : 'unknown')
    return json({ error: 'Errore imprevisto. Riprova.' }, 500)
  }
})
