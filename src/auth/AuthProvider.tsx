import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { parseProfile } from '../lib/guards'
import { rememberAuthNotice } from '../lib/format'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { mapAuthError } from '../lib/validators'
import type { Profile } from '../types'

type AuthContextValue = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, full_name, email, role, active, daily_goal, created_at')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return parseProfile(data)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  const applySession = useCallback(async (next: Session | null) => {
    setSession(next)
    if (!next?.user) {
      setProfile(null)
      return
    }
    try {
      const loaded = await fetchProfile(next.user.id)
      if (!loaded) {
        rememberAuthNotice('Profilo non trovato. Contatta un amministratore.')
        await getSupabase().auth.signOut()
        setSession(null)
        setProfile(null)
        return
      }
      if (!loaded.active) {
        rememberAuthNotice('Account disattivato. Contatta un amministratore.')
        await getSupabase().auth.signOut()
        setSession(null)
        setProfile(null)
        return
      }
      setProfile(loaded)
    } catch {
      rememberAuthNotice('Impossibile caricare il profilo. Riprova.')
      await getSupabase().auth.signOut()
      setSession(null)
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    let active = true
    void (async () => {
      const { data } = await getSupabase().auth.getSession()
      if (!active) return
      await applySession(data.session)
      if (active) setLoading(false)
    })()

    const { data: sub } = getSupabase().auth.onAuthStateChange((_event, next) => {
      void applySession(next).finally(() => {
        if (active) setLoading(false)
      })
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [applySession])

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) throw new Error(mapAuthError(error.message))
  }, [])

  const logout = useCallback(async () => {
    if (isSupabaseConfigured) await getSupabase().auth.signOut()
    setSession(null)
    setProfile(null)
    queryClient.clear()
  }, [queryClient])

  const refreshProfile = useCallback(async () => {
    if (!session?.user) {
      setProfile(null)
      return
    }
    await applySession(session)
  }, [applySession, session])

  const value = useMemo(
    () => ({ session, profile, loading, login, logout, refreshProfile }),
    [session, profile, loading, login, logout, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve essere usato dentro AuthProvider')
  return ctx
}
