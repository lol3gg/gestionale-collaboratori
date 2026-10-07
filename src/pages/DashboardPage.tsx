import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { useDashboardStats } from '../hooks/useDashboard'
import { useProfile } from '../hooks/useProfile'
import { statusLabel } from '../lib/labels'
import { errorMessage } from '../lib/validators'
import type { CompanyStatus } from '../types'

type Tone = { accent: string; value: string; wash: string }

const statusTone: Record<CompanyStatus, Tone> = {
  da_chiamare: { accent: '#64748b', value: 'text-slate-700', wash: 'bg-slate-50/80' },
  non_risponde: { accent: '#d97706', value: 'text-amber-700', wash: 'bg-amber-50/70' },
  da_richiamare: { accent: '#ea580c', value: 'text-orange-700', wash: 'bg-orange-50/70' },
  accettato: { accent: '#059669', value: 'text-emerald-700', wash: 'bg-emerald-50/70' },
  rifiutato: { accent: '#dc2626', value: 'text-red-700', wash: 'bg-red-50/70' },
  numero_errato: { accent: '#334155', value: 'text-slate-800', wash: 'bg-slate-100/80' },
}

const kpiTone: Tone[] = [
  { accent: '#1d4ed8', value: 'text-primary-700', wash: 'bg-primary-50/60' },
  { accent: '#0f766e', value: 'text-teal-800', wash: 'bg-teal-50/60' },
  { accent: '#0369a1', value: 'text-sky-800', wash: 'bg-sky-50/60' },
  { accent: '#4338ca', value: 'text-indigo-800', wash: 'bg-indigo-50/50' },
]

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: number
  hint?: string
  tone?: Tone
}) {
  const style = tone ?? { accent: '#1d4ed8', value: 'text-ink', wash: 'bg-surface' }
  return (
    <article
      className={`stat-card p-4 sm:p-5 ${style.wash}`}
      style={{ ['--stat-accent' as string]: style.accent }}
    >
      <p className="text-[13px] font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className={`mt-2.5 text-3xl font-semibold tracking-tight tabular-nums ${style.value}`}>{value}</p>
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
        <StatCard label="Totale aziende" value={stats.total} tone={kpiTone[0]} />
        <StatCard label={assignedLabel} value={stats.assigned} tone={kpiTone[1]} />
        <StatCard label="Chiamate oggi" value={stats.callsToday} tone={kpiTone[2]} />
        <StatCard label="Chiamate questa settimana" value={stats.callsThisWeek} hint="Da lunedì" tone={kpiTone[3]} />
      </div>
      <h2 className="mb-3 mt-9 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Per stato</h2>
      {stats.byStatus.length === 0 ? (
        <EmptyState title="Nessuno stato" description="Non ci sono aziende da classificare." />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
          {stats.byStatus.map((item) => (
            <StatCard key={item.status} label={statusLabel(item.status)} value={item.count} tone={statusTone[item.status]} />
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
                <li key={row.user_id} className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
                  <span className="flex min-w-0 items-center gap-3 text-[15px] text-ink">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-canvas text-xs font-semibold tabular-nums text-muted">
                      {index + 1}
                    </span>
                    <span className="truncate font-medium">{row.full_name}</span>
                  </span>
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums text-primary-700">
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
