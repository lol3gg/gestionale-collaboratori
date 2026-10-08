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
import { AUTH_BYPASS, BYPASS_PROFILE } from '../lib/authBypass'
import { parseProfile } from '../lib/guards'
import { rememberAuthNotice } from '../lib/format'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { mapAuthError } from '../lib/validators'
import { readViewAsRole, writeViewAsRole } from '../lib/viewAs'
import type { Profile, UserRole } from '../types'

type AuthContextValue = {
  session: Session | null
  /** Profilo effettivo (ruolo può essere override “vedi come”). */
  profile: Profile | null
  /** Ruolo reale sul database (senza override). */
  realRole: UserRole | null
  viewingAsCollaborator: boolean
  setViewAsCollaborator: (enabled: boolean) => void
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
  const [realProfile, setRealProfile] = useState<Profile | null>(AUTH_BYPASS ? BYPASS_PROFILE : null)
  const [viewAsRole, setViewAsRole] = useState<UserRole | null>(() => readViewAsRole())
  const [loading, setLoading] = useState(isSupabaseConfigured)

  const applySession = useCallback(async (next: Session | null) => {
    setSession(next)
    if (!next?.user) {
      setRealProfile(AUTH_BYPASS ? BYPASS_PROFILE : null)
      setViewAsRole(null)
      writeViewAsRole(null)
      return
    }
    try {
      const loaded = await fetchProfile(next.user.id)
      if (!loaded) {
        if (AUTH_BYPASS) {
          setRealProfile(BYPASS_PROFILE)
          return
        }
        rememberAuthNotice('Profilo non trovato. Contatta un amministratore.')
        await getSupabase().auth.signOut()
        setSession(null)
        setRealProfile(null)
        return
      }
      if (!loaded.active) {
        if (AUTH_BYPASS) {
          setRealProfile(BYPASS_PROFILE)
          return
        }
        rememberAuthNotice('Account disattivato. Contatta un amministratore.')
        await getSupabase().auth.signOut()
        setSession(null)
        setRealProfile(null)
        return
      }
      setRealProfile(loaded)
      if (loaded.role !== 'admin') {
        setViewAsRole(null)
        writeViewAsRole(null)
      }
    } catch {
      if (AUTH_BYPASS) {
        setRealProfile(BYPASS_PROFILE)
        return
      }
      rememberAuthNotice('Impossibile caricare il profilo. Riprova.')
      await getSupabase().auth.signOut()
      setSession(null)
      setRealProfile(null)
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
      if (data.session) await applySession(data.session)
      else if (AUTH_BYPASS) setRealProfile(BYPASS_PROFILE)
      else await applySession(null)
      if (active) setLoading(false)
    })()

    if (AUTH_BYPASS) {
      return () => {
        active = false
      }
    }

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
    if (AUTH_BYPASS) return
    const { error } = await getSupabase().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) throw new Error(mapAuthError(error.message))
  }, [])

  const logout = useCallback(async () => {
    if (AUTH_BYPASS) return
    if (isSupabaseConfigured) await getSupabase().auth.signOut()
    setSession(null)
    setRealProfile(null)
    setViewAsRole(null)
    writeViewAsRole(null)
    queryClient.clear()
  }, [queryClient])

  const refreshProfile = useCallback(async () => {
    if (AUTH_BYPASS) {
      setRealProfile(BYPASS_PROFILE)
      return
    }
    if (!session?.user) {
      setRealProfile(null)
      return
    }
    await applySession(session)
  }, [applySession, session])

  const setViewAsCollaborator = useCallback(
    (enabled: boolean) => {
      if (!realProfile || realProfile.role !== 'admin') return
      const next = enabled ? ('collaboratore' as const) : null
      setViewAsRole(next)
      writeViewAsRole(next)
      queryClient.clear()
    },
    [queryClient, realProfile],
  )

  const viewingAsCollaborator =
    realProfile?.role === 'admin' && viewAsRole === 'collaboratore'

  const profile = useMemo(() => {
    if (!realProfile) return null
    if (viewingAsCollaborator) return { ...realProfile, role: 'collaboratore' as const }
    return realProfile
  }, [realProfile, viewingAsCollaborator])

  const value = useMemo(
    () => ({
      session,
      profile,
      realRole: realProfile?.role ?? null,
      viewingAsCollaborator,
      setViewAsCollaborator,
      loading,
      login,
      logout,
      refreshProfile,
    }),
    [
      session,
      profile,
      realProfile?.role,
      viewingAsCollaborator,
      setViewAsCollaborator,
      loading,
      login,
      logout,
      refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve essere usato dentro AuthProvider')
  return ctx
}
