import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useDashboardStats } from '../../hooks/useDashboard'
import { useProfile } from '../../hooks/useProfile'
import { queryKeys } from '../../lib/api'
import { useToast } from '../ui/Toast'

const SEEN_KEY = 'gc_callback_toast_seen'

function loadSeen(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((item): item is string => typeof item === 'string'))
  } catch {
    return new Set()
  }
}

function saveSeen(ids: Set<string>) {
  sessionStorage.setItem(SEEN_KEY, JSON.stringify([...ids]))
}

/** Banner/toast in-app per richiami scaduti (una volta per azienda, poll ogni minuto). */
export function CallbackReminder() {
  const { profile } = useProfile()
  const stats = useDashboardStats(profile)
  const toast = useToast()
  const queryClient = useQueryClient()
  const seenRef = useRef<Set<string>>(loadSeen())

  useEffect(() => {
    const overdue = stats.data?.callbacksOverdue ?? []
    if (!profile || profile.role !== 'collaboratore' || overdue.length === 0) return

    for (const item of overdue) {
      if (seenRef.current.has(item.id)) continue
      seenRef.current.add(item.id)
      saveSeen(seenRef.current)
      toast.error(`Richiamo scaduto: ${item.name}`)
    }
  }, [profile, stats.data?.callbacksOverdue, toast])

  useEffect(() => {
    if (!profile || profile.role !== 'collaboratore') return

    const timer = window.setInterval(() => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard(profile.id, profile.role),
      })
    }, 60_000)

    return () => window.clearInterval(timer)
  }, [profile, queryClient])

  return null
}
