import { Link } from 'react-router-dom'
import { Phone } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { useDashboardStats } from '../hooks/useDashboard'
import { useProfile } from '../hooks/useProfile'
import { formatCallbackTime } from '../lib/callbacks'
import { telHref } from '../lib/phone'
import { statusLabel } from '../lib/labels'
import { errorMessage } from '../lib/validators'
import { statusAccentVar } from '../lib/statusColors'
import type { DashboardCallbackItem } from '../types'

function StatCard({
  label,
  value,
  hint,
  accent = 'var(--color-primary-600)',
}: {
  label: string
  value: number | string
  hint?: string
  accent?: string
}) {
  return (
    <article className="stat-card bg-surface p-4 sm:p-5" style={{ ['--stat-accent' as string]: accent }}>
      <p className="text-[13px] font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-2.5 text-3xl font-semibold tracking-tight tabular-nums text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </article>
  )
}

function CallbackList({
  title,
  items,
  hrefBase,
  danger,
  amber,
}: {
  title: string
  items: DashboardCallbackItem[]
  hrefBase: string
  danger?: boolean
  amber?: boolean
}) {
  if (items.length === 0) return null
  return (
    <div>
      <h3
        className={`mb-2 text-sm font-semibold ${
          danger ? 'text-danger-fg' : amber ? 'text-warning-fg' : 'text-ink'
        }`}
      >
        {title}
      </h3>
      <ul
        className={`overflow-hidden rounded-xl border divide-y ${
          danger
            ? 'border-danger-dot/30 bg-danger-bg divide-danger-dot/15'
            : amber
              ? 'border-warning-dot/35 bg-warning-bg divide-warning-dot/20'
              : 'card-surface divide-line'
        }`}
      >
        {items.map((item) => {
          const callLink = item.phone ? telHref(item.phone) : ''
          return (
            <li key={item.id} className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
              <Link
                to={`${hrefBase}?q=${encodeURIComponent(item.name)}`}
                className="min-w-0 flex-1 py-1"
              >
                <span
                  className={`block truncate font-medium ${
                    danger ? 'text-danger-fg' : amber ? 'text-warning-fg' : 'text-ink'
                  }`}
                >
                  {item.name}
                </span>
                <span
                  className={`mt-0.5 block text-sm tabular-nums ${
                    danger ? 'text-danger-fg/80' : amber ? 'text-warning-fg/80' : 'text-muted'
                  }`}
                >
                  {formatCallbackTime(item.callback_at)}
                </span>
              </Link>
              {callLink ? (
                <a
                  href={callLink}
                  className="btn-primary-solid inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold active:scale-[0.98]"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  Chiama
                </a>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function GoalBar({ current, goal }: { current: number; goal: number }) {
  const pct = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0
  return (
    <div className="card-surface p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-medium tracking-wide text-muted uppercase">Obiettivo giornaliero</p>
        <p className="text-sm font-semibold tabular-nums text-ink">
          {current} / {goal} chiamate
        </p>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-canvas">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-700 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { profile, loading } = useProfile()
  const query = useDashboardStats(profile)

  if (loading || !profile || query.isPending) {
    return (
      <section>
        <PageHeader title="Dashboard" />
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <Spinner className="h-8 w-8 text-primary-600" />
          <p className="text-sm text-muted">Caricamento…</p>
        </div>
      </section>
    )
  }

  if (query.isError) {
    return (
      <section>
        <PageHeader title="Dashboard" description={`Ciao ${profile.full_name}`} />
        <EmptyState
          title="Impossibile caricare la dashboard"
          description={errorMessage(query.error)}
          action={<Button onClick={() => void query.refetch()}>Riprova</Button>}
        />
      </section>
    )
  }

  const stats = query.data
  if (!stats) {
    return (
      <section>
        <PageHeader title="Dashboard" />
        <EmptyState title="Nessun dato" description="Non ci sono aziende da mostrare." />
      </section>
    )
  }

  const isCollab = profile.role === 'collaboratore'
  const callbacksHref = isCollab ? '/le-mie-aziende' : '/chiamate'
  const hasCallbacks = stats.callbacksOverdue.length > 0 || stats.callbacksToday.length > 0

  return (
    <section>
      <PageHeader
        title="Dashboard"
        description={
          isCollab
            ? `Ciao ${profile.full_name}. Le tue chiamate e i richiami.`
            : `Ciao ${profile.full_name}. Riepilogo di tutte le aziende.`
        }
      />

      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Richiami</h2>
      {!hasCallbacks ? (
        <EmptyState title="Nessun richiamo in scadenza" description="Non ci sono richiami scaduti o per oggi." />
      ) : (
        <div className="space-y-4">
          <CallbackList
            title={`Scaduti (${stats.callbacksOverdue.length})`}
            items={stats.callbacksOverdue}
            hrefBase={callbacksHref}
            danger
          />
          <CallbackList
            title={`Oggi (${stats.callbacksToday.length})`}
            items={stats.callbacksToday}
            hrefBase={callbacksHref}
            amber
          />
        </div>
      )}

      {isCollab ? (
        <>
          <h2 className="mb-3 mt-9 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Le tue statistiche</h2>
          <div className="mb-4">
            <GoalBar current={stats.callsToday} goal={stats.dailyGoal} />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <StatCard label="Chiamate oggi" value={stats.callsToday} />
            <StatCard label="Accettati oggi" value={stats.acceptedToday} accent="var(--color-success-dot)" />
            <StatCard label="Rifiutati oggi" value={stats.rejectedToday} accent="var(--color-danger-dot)" />
            <StatCard
              label="Tasso accettazione"
              value={stats.acceptanceRate30d === null ? '—' : `${stats.acceptanceRate30d}%`}
              hint="Ultimi 30 giorni"
            />
            <StatCard
              label="In carico"
              value={stats.claimedCount}
              hint={`Limite ${stats.claimLimit}`}
              accent="var(--color-primary-600)"
            />
          </div>
        </>
      ) : (
        <div className="mt-9 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatCard label="Totale aziende" value={stats.total} />
          <StatCard label="Assegnate" value={stats.assigned} />
          <StatCard label="Chiamate oggi" value={stats.callsToday} />
          <StatCard label="Chiamate questa settimana" value={stats.callsThisWeek} hint="Da lunedì" />
        </div>
      )}

      <h2 className="mb-3 mt-9 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Per stato</h2>
      {stats.byStatus.length === 0 ? (
        <EmptyState title="Nessuno stato" description="Non ci sono aziende da classificare." />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
          {stats.byStatus.map((item) => (
            <StatCard
              key={item.status}
              label={statusLabel(item.status)}
              value={item.count}
              accent={statusAccentVar[item.status]}
            />
          ))}
        </div>
      )}

      {!isCollab ? (
        <>
          <h2 className="mb-3 mt-9 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            Classifica collaboratori
          </h2>
          {stats.ranking.length === 0 ? (
            <EmptyState title="Nessun collaboratore" description="Non ci sono collaboratori da classificare." />
          ) : (
            <ol className="card-surface divide-y divide-line overflow-hidden">
              {stats.ranking.map((row, index) => (
                <li
                  key={row.user_id}
                  className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors duration-150 hover:bg-primary-50/40 sm:px-5"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <span className="flex min-w-0 items-center gap-3 text-[15px] text-ink">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums ${
                        index === 0
                          ? 'bg-gradient-to-br from-primary-400 to-primary-700 text-white'
                          : 'bg-canvas text-muted'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="truncate font-medium">{row.full_name}</span>
                  </span>
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums text-ink">
                    {row.accepted} accettate
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : null}
    </section>
  )
}
