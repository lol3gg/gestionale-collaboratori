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
import { AUTH_BYPASS, BYPASS_COLLABORATOR, BYPASS_PROFILE } from '../lib/authBypass'
import { parseProfile } from '../lib/guards'
import { rememberAuthNotice } from '../lib/format'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { mapAuthError } from '../lib/validators'
import { readBypassRole, readViewAsRole, writeBypassRole, writeViewAsRole } from '../lib/viewAs'
import type { Profile, UserRole } from '../types'

type AuthContextValue = {
  session: Session | null
  /** Profilo effettivo (ruolo può essere override “vedi come”). */
  profile: Profile | null
  /** Ruolo reale sul database (senza override). */
  realRole: UserRole | null
  viewingAsCollaborator: boolean
  setViewAsCollaborator: (enabled: boolean) => void
  /** Solo con AUTH_BYPASS: entra come admin o collaboratore. */
  enterAsRole: (role: UserRole) => void
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

function profileForBypassRole(role: UserRole): Profile {
  return role === 'collaboratore' ? { ...BYPASS_COLLABORATOR } : { ...BYPASS_PROFILE }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [bypassRole, setBypassRole] = useState<UserRole | null>(() =>
    AUTH_BYPASS ? readBypassRole() : null,
  )
  const [realProfile, setRealProfile] = useState<Profile | null>(() => {
    if (!AUTH_BYPASS) return null
    const role = readBypassRole()
    return role ? profileForBypassRole(role) : null
  })
  const [viewAsRole, setViewAsRole] = useState<UserRole | null>(() => readViewAsRole())
  const [loading, setLoading] = useState(isSupabaseConfigured && !AUTH_BYPASS)

  const applySession = useCallback(async (next: Session | null) => {
    setSession(next)
    if (!next?.user) {
      if (AUTH_BYPASS) {
        const role = readBypassRole()
        setBypassRole(role)
        setRealProfile(role ? profileForBypassRole(role) : null)
        return
      }
      setRealProfile(null)
      setViewAsRole(null)
      writeViewAsRole(null)
      return
    }
    try {
      const loaded = await fetchProfile(next.user.id)
      if (!loaded) {
        if (AUTH_BYPASS) {
          const role = readBypassRole()
          setRealProfile(role ? profileForBypassRole(role) : null)
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
          const role = readBypassRole()
          setRealProfile(role ? profileForBypassRole(role) : null)
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
        const role = readBypassRole()
        setRealProfile(role ? profileForBypassRole(role) : null)
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
      if (AUTH_BYPASS) {
        const role = readBypassRole()
        setBypassRole(role)
        setRealProfile(role ? profileForBypassRole(role) : null)
        if (active) setLoading(false)
        return
      }
      const { data } = await getSupabase().auth.getSession()
      if (!active) return
      await applySession(data.session)
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

  const enterAsRole = useCallback(
    (role: UserRole) => {
      writeBypassRole(role)
      setBypassRole(role)
      setRealProfile(profileForBypassRole(role))
      setViewAsRole(null)
      writeViewAsRole(null)
      queryClient.clear()
    },
    [queryClient],
  )

  const logout = useCallback(async () => {
    if (AUTH_BYPASS) {
      writeBypassRole(null)
      setBypassRole(null)
      setRealProfile(null)
      setViewAsRole(null)
      writeViewAsRole(null)
      queryClient.clear()
      return
    }
    if (isSupabaseConfigured) await getSupabase().auth.signOut()
    setSession(null)
    setRealProfile(null)
    setViewAsRole(null)
    writeViewAsRole(null)
    queryClient.clear()
  }, [queryClient])

  const refreshProfile = useCallback(async () => {
    if (AUTH_BYPASS) {
      const role = bypassRole ?? readBypassRole()
      setRealProfile(role ? profileForBypassRole(role) : null)
      return
    }
    if (!session?.user) {
      setRealProfile(null)
      return
    }
    await applySession(session)
  }, [applySession, bypassRole, session])

  const setViewAsCollaborator = useCallback(
    (enabled: boolean) => {
      if (AUTH_BYPASS) {
        enterAsRole(enabled ? 'collaboratore' : 'admin')
        return
      }
      if (!realProfile || realProfile.role !== 'admin') return
      const next = enabled ? ('collaboratore' as const) : null
      setViewAsRole(next)
      writeViewAsRole(next)
      queryClient.clear()
    },
    [enterAsRole, queryClient, realProfile],
  )

  const viewingAsCollaborator =
    !AUTH_BYPASS && realProfile?.role === 'admin' && viewAsRole === 'collaboratore'

  const profile = useMemo(() => {
    if (!realProfile) return null
    if (viewingAsCollaborator) return { ...realProfile, role: 'collaboratore' as const }
    return realProfile
  }, [realProfile, viewingAsCollaborator])

  const value = useMemo(
    () => ({
      session,
      profile,
      realRole: AUTH_BYPASS ? bypassRole : (realProfile?.role ?? null),
      viewingAsCollaborator: AUTH_BYPASS
        ? bypassRole === 'collaboratore'
        : viewingAsCollaborator,
      setViewAsCollaborator,
      enterAsRole,
      loading,
      login,
      logout,
      refreshProfile,
    }),
    [
      session,
      profile,
      bypassRole,
      realProfile?.role,
      viewingAsCollaborator,
      setViewAsCollaborator,
      enterAsRole,
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
