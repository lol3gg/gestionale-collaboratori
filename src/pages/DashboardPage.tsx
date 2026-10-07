import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { useDashboardStats } from '../hooks/useDashboard'
import { useProfile } from '../hooks/useProfile'
import { statusLabel } from '../lib/labels'
import { errorMessage } from '../lib/validators'
import type { CompanyStatus } from '../types'

/** Solo accenti sobri: blu primario + stati semantici essenziali. */
const statusAccent: Record<CompanyStatus, string> = {
  da_chiamare: 'var(--color-quiet-dot)',
  non_risponde: 'var(--color-warning-dot)',
  da_richiamare: 'var(--color-warning-dot)',
  accettato: 'var(--color-success-dot)',
  rifiutato: 'var(--color-danger-dot)',
  numero_errato: 'var(--color-dark-dot)',
}

function StatCard({
  label,
  value,
  hint,
  accent = 'var(--color-primary-600)',
}: {
  label: string
  value: number
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

  const assignedLabel = profile.role === 'admin' ? 'Assegnate' : 'Assegnate a te'

  return (
    <section>
      <PageHeader
        title="Dashboard"
        description={
          profile.role === 'admin'
            ? `Ciao ${profile.full_name}. Riepilogo di tutte le aziende.`
            : `Ciao ${profile.full_name}. Riepilogo delle aziende assegnate a te.`
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label="Totale aziende" value={stats.total} />
        <StatCard label={assignedLabel} value={stats.assigned} />
        <StatCard label="Chiamate oggi" value={stats.callsToday} />
        <StatCard label="Chiamate questa settimana" value={stats.callsThisWeek} hint="Da lunedì" />
      </div>
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
              accent={statusAccent[item.status]}
            />
          ))}
        </div>
      )}
      {profile.role === 'admin' ? (
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
                          ? 'bg-gradient-to-br from-primary-300 to-primary-600 text-ink'
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
