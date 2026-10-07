import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { useDashboardStats } from '../hooks/useDashboard'
import { useProfile } from '../hooks/useProfile'
import { statusLabel } from '../lib/labels'
import { errorMessage } from '../lib/validators'
import type { CompanyStatus } from '../types'

const statusTone: Record<CompanyStatus, string> = {
  da_chiamare: 'border-sky-400 bg-sky-50 text-sky-700',
  non_risponde: 'border-amber-400 bg-amber-50 text-amber-700',
  da_richiamare: 'border-orange-500 bg-orange-50 text-orange-600',
  accettato: 'border-emerald-500 bg-emerald-50 text-emerald-600',
  rifiutato: 'border-red-500 bg-red-50 text-red-600',
  numero_errato: 'border-slate-700 bg-slate-100 text-slate-800',
}

const kpiTone = [
  'border-primary-400 bg-primary-50 text-primary-700',
  'border-violet-400 bg-violet-50 text-violet-700',
  'border-cyan-400 bg-cyan-50 text-cyan-700',
  'border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700',
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
  tone?: string
}) {
  const parts = (tone ?? 'border-line bg-surface text-ink').split(' ')
  const border = parts[0] ?? 'border-line'
  const bg = parts[1] ?? 'bg-surface'
  const valueColor = parts[2] ?? 'text-ink'
  return (
    <article className={`rounded-[1.25rem] border-2 p-4 shadow-card sm:p-5 ${border} ${bg}`}>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className={`mt-2 text-3xl font-bold tracking-tight tabular-nums ${valueColor}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Totale aziende" value={stats.total} tone={kpiTone[0]} />
        <StatCard label={assignedLabel} value={stats.assigned} tone={kpiTone[1]} />
        <StatCard label="Chiamate oggi" value={stats.callsToday} tone={kpiTone[2]} />
        <StatCard label="Chiamate questa settimana" value={stats.callsThisWeek} hint="Da lunedì" tone={kpiTone[3]} />
      </div>
      <h2 className="mb-3 mt-8 text-sm font-semibold tracking-wide text-muted">Per stato</h2>
      {stats.byStatus.length === 0 ? (
        <EmptyState title="Nessuno stato" description="Non ci sono aziende da classificare." />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {stats.byStatus.map((item) => (
            <StatCard key={item.status} label={statusLabel(item.status)} value={item.count} tone={statusTone[item.status]} />
          ))}
        </div>
      )}
      {profile.role === 'admin' ? (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold tracking-wide text-muted">Classifica collaboratori</h2>
          {stats.ranking.length === 0 ? (
            <EmptyState title="Nessun collaboratore" description="Non ci sono collaboratori da classificare." />
          ) : (
            <ol className="card-surface divide-y divide-line overflow-hidden">
              {stats.ranking.map((row, index) => (
                <li key={row.user_id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <span className="text-[15px] text-ink">
                    <span className="mr-3 tabular-nums text-muted">{index + 1}</span>
                    {row.full_name}
                  </span>
                  <span className="text-[15px] font-medium tabular-nums text-ink">{row.accepted} accettate</span>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : null}
    </section>
  )
}
