import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type UserRole = 'admin' | 'collaboratore'

type CreateInput = {
  action: 'create'
  full_name: string
  email: string
  password: string
  role: UserRole
}

type UpdateInput = {
  action: 'update'
  user_id: string
  full_name: string
  role: UserRole
}

type SetActiveInput = {
  action: 'set_active'
  user_id: string
  active: boolean
}

type ResetInput = {
  action: 'reset_password'
  user_id: string
  password: string
}

type ActionInput = CreateInput | UpdateInput | SetActiveInput | ResetInput

type ParseResult = { ok: true; value: ActionInput } | { ok: false; error: string }

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function json(body: { ok?: boolean; error?: string }, status = 200): Response {
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

function validateFullName(value: string): string | null {
  const name = value.trim()
  if (name.length < 2) return 'Inserisci il nome completo'
  if (name.length > 120) return 'Il nome non può superare 120 caratteri'
  return null
}

function validateEmail(value: string): string | null {
  const email = value.trim().toLowerCase()
  if (!emailPattern.test(email) || email.length > 254) return 'Inserisci un indirizzo email valido'
  return null
}

function validatePassword(value: string): string | null {
  if (value.length < 8) return 'La password deve avere almeno 8 caratteri'
  if (value.length > 72) return 'La password non può superare 72 caratteri'
  return null
}

function parseRole(value: string): UserRole | null {
  return value === 'admin' || value === 'collaboratore' ? value : null
}

function parseUserId(value: string | null): string | null {
  if (!value || !uuidPattern.test(value)) return null
  return value
}

function parseAction(body: unknown): ParseResult {
  if (!isRecord(body)) return { ok: false, error: 'Richiesta non valida' }
  const action = readString(body, 'action')

  if (action === 'create') {
    const fullName = readString(body, 'full_name')
    const email = readString(body, 'email')
    const password = readString(body, 'password')
    const roleValue = readString(body, 'role') ?? 'collaboratore'
    if (fullName === null || email === null || password === null) {
      return { ok: false, error: 'Richiesta non valida' }
    }
    const nameError = validateFullName(fullName)
    if (nameError) return { ok: false, error: nameError }
    const emailError = validateEmail(email)
    if (emailError) return { ok: false, error: emailError }
    const passwordError = validatePassword(password)
    if (passwordError) return { ok: false, error: passwordError }
    const role = parseRole(roleValue)
    if (!role) return { ok: false, error: 'Seleziona un ruolo valido' }
    return {
      ok: true,
      value: {
        action: 'create',
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      },
    }
  }

  if (action === 'update') {
    const userId = parseUserId(readString(body, 'user_id'))
    const fullName = readString(body, 'full_name')
    const roleValue = readString(body, 'role')
    if (!userId || fullName === null || roleValue === null) return { ok: false, error: 'Richiesta non valida' }
    const nameError = validateFullName(fullName)
    if (nameError) return { ok: false, error: nameError }
    const role = parseRole(roleValue)
    if (!role) return { ok: false, error: 'Seleziona un ruolo valido' }
    return { ok: true, value: { action: 'update', user_id: userId, full_name: fullName.trim(), role } }
  }

  if (action === 'set_active') {
    const userId = parseUserId(readString(body, 'user_id'))
    const active = body.active
    if (!userId || typeof active !== 'boolean') return { ok: false, error: 'Richiesta non valida' }
    return { ok: true, value: { action: 'set_active', user_id: userId, active } }
  }

  if (action === 'reset_password') {
    const userId = parseUserId(readString(body, 'user_id'))
    const password = readString(body, 'password')
    if (!userId || password === null) return { ok: false, error: 'Richiesta non valida' }
    const passwordError = validatePassword(password)
    if (passwordError) return { ok: false, error: passwordError }
    return { ok: true, value: { action: 'reset_password', user_id: userId, password } }
  }

  return { ok: false, error: 'Azione non riconosciuta' }
}

function parseCaller(value: unknown): { role: string; active: boolean } | null {
  if (!isRecord(value)) return null
  if (typeof value.role !== 'string' || typeof value.active !== 'boolean') return null
  return { role: value.role, active: value.active }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return json({ error: 'Configurazione del server incompleta' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Non autenticato' }, 401)
    const token = authHeader.slice('Bearer '.length).trim()
    if (!token) return json({ error: 'Non autenticato' }, 401)

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: userData, error: userError } = await authClient.auth.getUser(token)
    if (userError || !userData.user) return json({ error: 'Non autenticato' }, 401)
    const callerId = userData.user.id

    const { data: callerRow, error: callerError } = await adminClient
      .from('profiles')
      .select('role, active')
      .eq('id', callerId)
      .maybeSingle()
    if (callerError) {
      console.error(callerError)
      return json({ error: 'Errore imprevisto. Riprova.' }, 500)
    }
    const caller = parseCaller(callerRow)
    if (!caller || caller.role !== 'admin' || !caller.active) {
      return json({ error: 'Operazione riservata agli amministratori' }, 403)
    }

    let payload: unknown
    try {
      payload = await req.json()
    } catch {
      return json({ error: 'Richiesta non valida' }, 400)
    }
    const parsed = parseAction(payload)
    if (!parsed.ok) return json({ error: parsed.error }, 400)
    const input = parsed.value

    const ensureProfile = async (userId: string): Promise<Response | null> => {
      const { data, error } = await adminClient.from('profiles').select('id').eq('id', userId).maybeSingle()
      if (error) {
        console.error(error)
        return json({ error: 'Errore imprevisto. Riprova.' }, 500)
      }
      if (!isRecord(data) || typeof data.id !== 'string') return json({ error: 'Utente non trovato' }, 404)
      return null
    }

    if (input.action === 'create') {
      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: { full_name: input.full_name, role: input.role },
      })
      if (createError || !created?.user) {
        const message = createError?.message?.toLowerCase() ?? ''
        if (message.includes('already') || message.includes('registered') || message.includes('exists')) {
          return json({ error: 'Esiste già un utente con questa email' }, 409)
        }
        console.error(createError)
        return json({ error: 'Impossibile creare l’utente' }, 400)
      }

      const { error: upsertError } = await adminClient.from('profiles').upsert({
        id: created.user.id,
        full_name: input.full_name,
        email: input.email,
        role: input.role,
        active: true,
      })
      if (upsertError) {
        console.error(upsertError)
        await adminClient.auth.admin.deleteUser(created.user.id)
        return json({ error: 'Impossibile creare il profilo' }, 500)
      }
      return json({ ok: true })
    }

    if (input.action === 'update') {
      if (input.user_id === callerId && input.role !== 'admin') {
        return json({ error: 'Non puoi modificare il tuo ruolo' }, 400)
      }
      const missing = await ensureProfile(input.user_id)
      if (missing) return missing
      const { error: updateError } = await adminClient
        .from('profiles')
        .update({ full_name: input.full_name, role: input.role })
        .eq('id', input.user_id)
      if (updateError) {
        console.error(updateError)
        return json({ error: 'Impossibile aggiornare il collaboratore' }, 500)
      }
      const { error: metadataError } = await adminClient.auth.admin.updateUserById(input.user_id, {
        user_metadata: { full_name: input.full_name, role: input.role },
      })
      if (metadataError) console.error(metadataError)
      return json({ ok: true })
    }

    if (input.action === 'set_active') {
      if (input.user_id === callerId && !input.active) {
        return json({ error: 'Non puoi disattivare il tuo account' }, 400)
      }
      const missing = await ensureProfile(input.user_id)
      if (missing) return missing
      const { error: activeError } = await adminClient
        .from('profiles')
        .update({ active: input.active })
        .eq('id', input.user_id)
      if (activeError) {
        console.error(activeError)
        return json({ error: 'Impossibile aggiornare lo stato' }, 500)
      }
      return json({ ok: true })
    }

    if (input.action === 'reset_password') {
      const missing = await ensureProfile(input.user_id)
      if (missing) return missing
      const { error: passwordError } = await adminClient.auth.admin.updateUserById(input.user_id, {
        password: input.password,
      })
      if (passwordError) {
        console.error(passwordError)
        return json({ error: 'Impossibile aggiornare la password' }, 500)
      }
      return json({ ok: true })
    }

    return json({ error: 'Azione non riconosciuta' }, 400)
  } catch (error) {
    console.error(error)
    return json({ error: 'Errore imprevisto. Riprova.' }, 500)
  }
})
