import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AUTH_NOTICE_KEY } from '../lib/format'
import { parseProfile } from '../lib/guards'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { mapAuthError } from '../lib/validators'
import type { Profile, UserRole } from '../types'
import { isDemoMode } from '../lib/demo'
import { clearDemoRole, profileForDemoRole, readDemoRole, writeDemoRole } from '../lib/mock/session'

type AuthContextValue = {
  profile: Profile | null
  loading: boolean
  profileError: string | null
  isDemo: boolean
  enterAs: (role: UserRole) => string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshProfile: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, full_name, email, role, active, created_at')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new Error('Impossibile caricare il profilo')
  return parseProfile(data)
}

function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [profileError, setProfileError] = useState<string | null>(null)
  const ready = useRef(false)
  const signingOut = useRef(false)
  const explicitLogin = useRef(false)

  const logout = useCallback(async () => {
    if (!isSupabaseConfigured) return
    await getSupabase().auth.signOut()
    setSession(null)
    setProfile(null)
    setProfileError(null)
  }, [])

  const rejectInactive = useCallback(async () => {
    if (signingOut.current) return
    signingOut.current = true
    setSession(null)
    setProfile(null)
    setProfileError(null)
    try {
      await getSupabase().auth.signOut()
    } finally {
      signingOut.current = false
    }
  }, [])

  const syncSession = useCallback(
    async (nextSession: Session | null) => {
      if (!isSupabaseConfigured) {
        setLoading(false)
        return
      }
      const showSpinner = !ready.current
      if (showSpinner) setLoading(true)
      try {
        if (!nextSession) {
          setSession(null)
          setProfile(null)
          setProfileError(null)
          return
        }
        const nextProfile = await loadProfile(nextSession.user.id)
        if (!nextProfile) {
          setSession(nextSession)
          setProfile(null)
          setProfileError('Profilo non trovato')
          return
        }
        if (!nextProfile.active) {
          if (!explicitLogin.current) {
            sessionStorage.setItem(AUTH_NOTICE_KEY, 'Account disattivato')
          }
          await rejectInactive()
          return
        }
        setSession(nextSession)
        setProfile(nextProfile)
        setProfileError(null)
      } catch (error) {
        if (!ready.current) {
          setSession(nextSession)
          setProfile(null)
          setProfileError(error instanceof Error ? error.message : 'Impossibile caricare il profilo')
        }
      } finally {
        ready.current = true
        setLoading(false)
      }
    },
    [rejectInactive],
  )

  useEffect(() => {
    if (!isSupabaseConfigured) return
    void getSupabase()
      .auth.getSession()
      .then(({ data }) => syncSession(data.session))
    const { data: subscription } = getSupabase().auth.onAuthStateChange((_event, nextSession) => {
      setTimeout(() => {
        void syncSession(nextSession)
      }, 0)
    })
    return () => subscription.subscription.unsubscribe()
  }, [syncSession])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void getSupabase()
        .auth.getSession()
        .then(({ data }) => syncSession(data.session))
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [syncSession])

  const login = useCallback(async (email: string, password: string) => {
    explicitLogin.current = true
    const supabase = getSupabase()
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (error) throw new Error(mapAuthError(error.message))

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session) throw new Error('Accesso non riuscito')

      const nextProfile = await loadProfile(sessionData.session.user.id)
      if (!nextProfile) {
        await supabase.auth.signOut()
        throw new Error('Profilo non trovato')
      }
      if (!nextProfile.active) {
        sessionStorage.removeItem(AUTH_NOTICE_KEY)
        await supabase.auth.signOut()
        throw new Error('Account disattivato')
      }
      sessionStorage.removeItem(AUTH_NOTICE_KEY)
      setSession(sessionData.session)
      setProfile(nextProfile)
      setProfileError(null)
    } finally {
      setTimeout(() => {
        explicitLogin.current = false
      }, 0)
    }
  }, [])

  const refreshProfile = useCallback(() => {
    if (!isSupabaseConfigured) return
    void getSupabase()
      .auth.getSession()
      .then(({ data }) => syncSession(data.session))
  }, [syncSession])

  const enterAs = useCallback((role: UserRole): string | null => {
    void role
    return 'La scelta del ruolo è disponibile solo in modalità demo'
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      profile,
      loading,
      profileError,
      isDemo: false,
      enterAs,
      login,
      logout,
      refreshProfile,
    }),
    [profile, loading, profileError, enterAs, login, logout, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(() => {
    const role = readDemoRole()
    if (!role) return null
    const next = profileForDemoRole(role)
    if (!next) {
      clearDemoRole()
      sessionStorage.setItem(AUTH_NOTICE_KEY, 'Account disattivato')
      return null
    }
    return next
  })
  const [profileError, setProfileError] = useState<string | null>(null)

  const enterAs = useCallback((role: UserRole): string | null => {
    const next = profileForDemoRole(role)
    if (!next) {
      clearDemoRole()
      return 'Account disattivato'
    }
    writeDemoRole(role)
    setProfile(next)
    setProfileError(null)
    return null
  }, [])

  const logout = useCallback(async () => {
    clearDemoRole()
    setProfile(null)
    setProfileError(null)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    void email
    void password
    throw new Error('Il login con email sarà disponibile quando la modalità demo è disattivata')
  }, [])

  const refreshProfile = useCallback(() => {
    const role = readDemoRole()
    if (!role) {
      setProfile(null)
      return
    }
    const next = profileForDemoRole(role)
    if (!next) {
      clearDemoRole()
      sessionStorage.setItem(AUTH_NOTICE_KEY, 'Account disattivato')
      setProfile(null)
      return
    }
    setProfile(next)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      profile,
      loading: false,
      profileError,
      isDemo: true,
      enterAs,
      login,
      logout,
      refreshProfile,
    }),
    [profile, profileError, enterAs, login, logout, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (isDemoMode) return <DemoAuthProvider>{children}</DemoAuthProvider>
  return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve essere usato dentro AuthProvider')
  return context
}
