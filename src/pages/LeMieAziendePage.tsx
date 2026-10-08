import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CallCard } from '../components/calls/CallCard'
import { CallbackModal } from '../components/calls/CallbackModal'
import { CallQueueFilters } from '../components/calls/CallQueueFilters'
import { CallQueueTabs } from '../components/calls/CallQueueTabs'
import { NextCompanyMode } from '../components/calls/NextCompanyMode'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { useCallQueueBoard } from '../hooks/useCallQueueBoard'
import { useDashboardStats } from '../hooks/useDashboard'
import { useProfile } from '../hooks/useProfile'
import { CLAIM_LIMIT } from '../lib/api'
import { errorMessage } from '../lib/validators'

export function LeMieAziendePage() {
  const { profile, loading } = useProfile()
  const board = useCallQueueBoard(profile)
  const stats = useDashboardStats(profile)
  const [searchParams] = useSearchParams()
  const qParam = searchParams.get('q') ?? ''
  const [nextMode, setNextMode] = useState(false)

  useEffect(() => {
    if (qParam) board.setQuery(qParam)
  }, [qParam, board.setQuery])

  const claimedCount = stats.data?.claimedCount ?? 0
  const claimLimit = stats.data?.claimLimit ?? CLAIM_LIMIT

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
    <section className="overflow-x-hidden pb-24">
      <PageHeader
        title="Le mie aziende"
        description="Apri un’azienda con Mostra per chiamare e registrare l’esito. Se era nel pool, viene presa in carico automaticamente."
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

      {board.visibleTotal === 0 ? (
        <EmptyState title="Nessuna azienda in questa scheda" description="Prova un’altra scheda o allenta i filtri." />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            Mostro {board.visible.length} di {board.visibleTotal}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 xl:gap-3">
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
                claimedCount={claimedCount}
                claimLimit={claimLimit}
                onNote={(value) => board.setNotes((current) => ({ ...current, [company.id]: value }))}
                onOutcome={(outcome) => board.saveOutcome(company, outcome, null)}
                onCallback={() => board.setCallbackFor(company)}
                onClaim={() => board.claim.mutate(company.id)}
                onRelease={() => board.release.mutate(company.id)}
                onUndo={(logId) => board.undo.mutate(logId)}
              />
            ))}
          </div>
          {board.hasMore ? (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" onClick={board.loadMore}>
                Carica altre
              </Button>
            </div>
          ) : null}
        </>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 md:bottom-6">
        <Button
          className="pointer-events-auto min-h-14 w-full max-w-lg rounded-2xl text-base font-bold shadow-lift"
          onClick={() => setNextMode(true)}
        >
          Prossima azienda
        </Button>
      </div>

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

      <NextCompanyMode open={nextMode} profile={profile} onClose={() => setNextMode(false)} />
    </section>
  )
}
