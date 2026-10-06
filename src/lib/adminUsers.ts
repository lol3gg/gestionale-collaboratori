import { FunctionsHttpError } from '@supabase/supabase-js'
import type { AdminUsersRequest } from '../types'
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
      return 'Impossibile contattare il servizio. Verifica che la funzione admin-users sia deployata.'
    }
    return error.message
  }
  return 'Operazione non riuscita'
}

export async function invokeAdminUsers(body: AdminUsersRequest): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Configura VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY')
  }
  const { data, error } = await getSupabase().functions.invoke('admin-users', { body })
  if (error) throw new Error(await readInvokeError(error))
  if (isErrorPayload(data)) throw new Error(data.error)
}
