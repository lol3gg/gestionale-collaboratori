import { FunctionsHttpError } from '@supabase/supabase-js'
import type { PlacesSearchDraft, SearchProcessResponse } from '../types'
import { isRecord } from './guards'
import { getSupabase, isSupabaseConfigured } from './supabase'

function isErrorPayload(value: unknown): value is { error: string } {
  return isRecord(value) && typeof value.error === 'string'
}

async function readInvokeError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const context: unknown = error.context
    if (isErrorPayload(context)) return context.error
    if (context instanceof Response) {
      try {
        const payload: unknown = await context.json()
        if (isErrorPayload(payload)) return payload.error
      } catch {
        return 'Operazione non riuscita'
      }
    }
  }
  if (error instanceof Error) {
    if (error.message.includes('Failed to send a request to the Edge Function')) {
      return 'Impossibile contattare il servizio. Verifica che search-companies sia deployata.'
    }
    return error.message
  }
  return 'Operazione non riuscita'
}

export async function invokeSearchCompaniesStart(draft: PlacesSearchDraft): Promise<SearchProcessResponse> {
  if (!isSupabaseConfigured) {
    throw new Error('Configura VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY')
  }
  const { data, error } = await getSupabase().functions.invoke('search-companies', {
    body: {
      action: 'start',
      country: draft.country,
      regions: draft.regions,
      provinces: draft.provinces ?? [],
      keywords: draft.keywords,
      max_requests: draft.max_requests,
      estimated_queries: draft.estimated_queries,
      estimated_cost_eur: draft.estimated_cost_eur,
      auto_add: draft.auto_add,
      name: draft.name,
    },
  })
  if (error) throw new Error(await readInvokeError(error))
  const payload = (data ?? {}) as SearchProcessResponse
  if (payload.error && !payload.search_id) throw new Error(payload.error)
  return payload
}

export async function invokeSearchCompaniesProcess(searchId: string): Promise<SearchProcessResponse> {
  if (!isSupabaseConfigured) {
    throw new Error('Configura VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY')
  }
  const { data, error } = await getSupabase().functions.invoke('search-companies', {
    body: { action: 'process', search_id: searchId },
  })
  if (error) throw new Error(await readInvokeError(error))
  const payload = (data ?? {}) as SearchProcessResponse
  if (payload.error && !payload.search_id && payload.done !== true) throw new Error(payload.error)
  return payload
}

export async function invokeSearchCompaniesPause(searchId: string): Promise<SearchProcessResponse> {
  if (!isSupabaseConfigured) {
    throw new Error('Configura VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY')
  }
  const { data, error } = await getSupabase().functions.invoke('search-companies', {
    body: { action: 'pause', search_id: searchId },
  })
  if (error) throw new Error(await readInvokeError(error))
  return (data ?? {}) as SearchProcessResponse
}

export async function invokeSearchCompaniesResume(searchId: string): Promise<SearchProcessResponse> {
  if (!isSupabaseConfigured) {
    throw new Error('Configura VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY')
  }
  const { data, error } = await getSupabase().functions.invoke('search-companies', {
    body: { action: 'resume', search_id: searchId },
  })
  if (error) throw new Error(await readInvokeError(error))
  const payload = (data ?? {}) as SearchProcessResponse
  if (payload.error && !payload.search_id && !payload.paused) throw new Error(payload.error)
  return payload
}
