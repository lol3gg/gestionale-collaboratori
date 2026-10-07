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

export function LeMieAziendePage() {
  const { profile, loading } = useProfile()
  const board = useCallQueueBoard(profile)

  if (loading || !profile || board.queue.isPending) {
    return (
      <section>
        <PageHeader title="Le mie aziende" />
        <div className="flex justify-center py-24">
          <Spinner className="h-8 w-8 text-primary-600" />
        </div>
      </section>
    )
  }

  if (board.queue.isError) {
    return (
      <section>
        <PageHeader title="Le mie aziende" description="Chiama e registra gli esiti dalle schede." />
        <EmptyState
          title="Impossibile caricare le aziende"
          description={errorMessage(board.queue.error)}
          action={<Button onClick={() => void board.queue.refetch()}>Riprova</Button>}
        />
      </section>
    )
  }

  return (
    <section className="overflow-x-hidden">
      <PageHeader
        title="Le mie aziende"
        description="Le aziende assegnate a te e quelle ancora nel pool. Registra gli esiti da qui."
      />

      <div className="lg:hidden">
        <CallQueueFilters
          collapsible
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
      </div>
      <div className="hidden lg:block">
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
      </div>

      <CallQueueTabs tab={board.tab} counts={board.counts} onChange={board.setTab} />

      {board.visible.length === 0 ? (
        <EmptyState title="Nessuna azienda in questa scheda" description="Prova un’altra scheda o allenta i filtri." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {board.visible.map((company) => (
            <CallCard
              key={company.id}
              mode="collaborator"
              company={company}
              logs={board.logs}
              people={board.people}
              profile={profile}
              note={board.notes[company.id] ?? ''}
              busy={board.busyId === company.id || board.undo.isPending}
              onNote={(value) => board.setNotes((current) => ({ ...current, [company.id]: value }))}
              onOutcome={(outcome) => board.saveOutcome(company, outcome, null)}
              onCallback={() => board.setCallbackFor(company)}
              onClaim={() => board.claim.mutate(company.id)}
              onUndo={(logId) => board.undo.mutate(logId)}
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
          board.saveOutcome(board.callbackFor, 'da_richiamare', callbackAt)
        }}
      />
    </section>
  )
}
