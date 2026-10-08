import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CallCard } from '../components/calls/CallCard'
import { CallbackModal } from '../components/calls/CallbackModal'
import { CallQueueFilters } from '../components/calls/CallQueueFilters'
import { CallQueueTabs } from '../components/calls/CallQueueTabs'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { useCallQueueBoard } from '../hooks/useCallQueueBoard'
import { useProfile } from '../hooks/useProfile'
import { errorMessage } from '../lib/validators'

export function ChiamatePage() {
  const { profile, loading } = useProfile()
  const board = useCallQueueBoard(profile)
  const [searchParams] = useSearchParams()
  const qParam = searchParams.get('q') ?? ''

  useEffect(() => {
    if (qParam) board.setQuery(qParam)
  }, [qParam, board.setQuery])

  if (loading || !profile || board.queue.isPending) {
    return (
      <section>
        <PageHeader title="Chiamate" />
        <div className="flex justify-center py-24">
          <Spinner className="h-8 w-8 text-primary-600" />
        </div>
      </section>
    )
  }

  if (board.queue.isError) {
    return (
      <section>
        <PageHeader title="Chiamate" description="Aziende con un numero di telefono." />
        <EmptyState
          title="Impossibile caricare le chiamate"
          description={errorMessage(board.queue.error)}
          action={<Button onClick={() => void board.queue.refetch()}>Riprova</Button>}
        />
      </section>
    )
  }

  return (
    <section>
      <PageHeader
        title="Chiamate"
        description="Tutte le aziende con telefono. Puoi riassegnarle o rimetterle nel pool."
      />

      <CallQueueFilters
        query={board.query}
        region={board.region}
        province={board.province}
        city={board.city}
        regions={board.regions}
        provinces={board.provinces}
        cities={board.cities}
        onQuery={board.setQuery}
        onRegion={board.setRegion}
        onProvince={board.setProvince}
        onCity={board.setCity}
      />

      <CallQueueTabs tab={board.tab} counts={board.counts} onChange={board.setTab} />

      {board.visible.length === 0 ? (
        <EmptyState title="Nessuna azienda in questa scheda" description="Prova un’altra scheda o allenta i filtri." />
      ) : (
        <div className="space-y-2">
          {board.visible.map((company) => (
            <CallCard
              key={company.id}
              mode="admin"
              company={company}
              logs={board.logs}
              people={board.people}
              profile={profile}
              note={board.notes[company.id] ?? ''}
              busy={board.busyId === company.id}
              onNote={(value) => board.setNotes((current) => ({ ...current, [company.id]: value }))}
              onOutcome={(outcome) => board.saveOutcome(company, outcome, null)}
              onCallback={() => board.setCallbackFor(company)}
              onClaim={() => board.claim.mutate(company.id)}
              onAssign={(assigneeId) => board.assign.mutate({ id: company.id, assigneeId })}
              onRelease={() => board.release.mutate(company.id)}
            />
          ))}
        </div>
      )}

      <CallbackModal
        open={board.callbackFor !== null}
        companyName={board.callbackFor?.name ?? ''}
        pending={board.record.isPending && board.record.variables?.companyId === board.callbackFor?.id}
        onClose={() => board.setCallbackFor(null)}
        onConfirm={(callbackAt) => {
          if (!board.callbackFor) return
          void board.saveOutcome(board.callbackFor, 'da_richiamare', callbackAt)
        }}
      />
    </section>
  )
}
