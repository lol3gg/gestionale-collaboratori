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
  da_chiamare: 'border-slate-400 text-slate-800',
  non_risponde: 'border-yellow-400 text-yellow-600',
  da_richiamare: 'border-orange-500 text-orange-600',
  accettato: 'border-emerald-500 text-emerald-600',
  rifiutato: 'border-red-500 text-red-600',
  numero_errato: 'border-slate-900 text-slate-900',
}

function StatCard({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone?: string }) {
  const [border, valueColor] = tone ? tone.split(' ') : ['border-slate-200', 'text-slate-900']
  return (
    <article className={`rounded-xl border-2 bg-white p-4 shadow-sm sm:p-5 ${border}`}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight ${valueColor}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
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
        <div className="flex justify-center py-24">
          <Spinner className="h-8 w-8 text-indigo-600" />
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
        <StatCard label="Totale aziende" value={stats.total} />
        <StatCard label={assignedLabel} value={stats.assigned} />
        <StatCard label="Chiamate oggi" value={stats.callsToday} />
        <StatCard label="Chiamate questa settimana" value={stats.callsThisWeek} hint="Da lunedì" />
      </div>
      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Per stato</h2>
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
          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Classifica collaboratori
          </h2>
          {stats.ranking.length === 0 ? (
            <EmptyState title="Nessun collaboratore" description="Non ci sono collaboratori da classificare." />
          ) : (
            <ol className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {stats.ranking.map((row, index) => (
                <li key={row.user_id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="text-sm text-slate-900">
                    <span className="mr-3 tabular-nums text-slate-400">{index + 1}</span>
                    {row.full_name}
                  </span>
                  <span className="text-sm font-medium tabular-nums text-slate-700">
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
