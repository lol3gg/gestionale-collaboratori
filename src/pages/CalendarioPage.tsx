import { useMemo, useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Select } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { useBookExplanation, useCancelExplanation, useExplanationBookings } from '../hooks/useCalendar'
import { useCompanies } from '../hooks/useCompanies'
import { useCollaborators } from '../hooks/useCollaborators'
import { useProfile } from '../hooks/useProfile'
import {
  addDays,
  explanationSlots,
  formatClock,
  isSameLocalDay,
  mondayOf,
  slotBounds,
  type SlotMinutes,
} from '../lib/calendar'
import { errorMessage } from '../lib/validators'
import type { ExplanationBooking } from '../types'

const dayTitle = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
const weekTitle = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' })
const weekTitleYear = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
const slotTitle = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })

function bookingOn(bookings: ExplanationBooking[], day: Date, slot: SlotMinutes): ExplanationBooking | null {
  const { starts } = slotBounds(day, slot)
  return bookings.find((booking) => new Date(booking.starts_at).getTime() === starts.getTime()) ?? null
}

export function CalendarioPage() {
  const { profile, loading } = useProfile()
  const bookingsQuery = useExplanationBookings(profile)
  const companiesQuery = useCompanies(profile)
  const peopleQuery = useCollaborators()
  const book = useBookExplanation(profile)
  const cancel = useCancelExplanation(profile)
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [draft, setDraft] = useState<{ startsAt: string; label: string } | null>(null)
  const [companyId, setCompanyId] = useState('')

  const slots = explanationSlots()
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart])
  const companies = useMemo(
    () => [...(companiesQuery.data ?? [])].sort((left, right) => left.name.localeCompare(right.name, 'it')),
    [companiesQuery.data],
  )
  const people = peopleQuery.data ?? []
  const bookings = bookingsQuery.data ?? []
  const isAdmin = profile?.role === 'admin'
  const capacity = slots.length

  function openDraft(day: Date, slot: SlotMinutes) {
    const bounds = slotBounds(day, slot)
    const first = companies[0]
    setCompanyId(first?.id ?? '')
    setDraft({
      startsAt: bounds.starts.toISOString(),
      label: `${slotTitle.format(bounds.starts)}, ${formatClock(slot.startMin)}–${formatClock(slot.endMin)}`,
    })
  }

  if (loading || !profile || bookingsQuery.isPending || companiesQuery.isPending) {
    return (
      <section>
        <PageHeader title="Calendario" />
        <div className="flex justify-center py-24">
          <Spinner className="h-8 w-8 text-indigo-600" />
        </div>
      </section>
    )
  }

  if (bookingsQuery.isError || companiesQuery.isError) {
    return (
      <section>
        <PageHeader title="Calendario" />
        <EmptyState
          title="Impossibile caricare il calendario"
          description={errorMessage(bookingsQuery.error ?? companiesQuery.error)}
          action={
            <Button
              onClick={() => {
                void bookingsQuery.refetch()
                void companiesQuery.refetch()
              }}
            >
              Riprova
            </Button>
          }
        />
      </section>
    )
  }

  const range = `${weekTitle.format(weekStart)} – ${weekTitleYear.format(addDays(weekStart, 6))}`

  return (
    <section>
      <PageHeader
        title="Calendario"
        description={
          isAdmin
            ? 'Disponibilità per le call di spiegazione, dalle 17:30 alle 19:30. Ogni call dura 45 minuti.'
            : 'Fissa una call di spiegazione con l’admin, dalle 17:30 alle 19:30. Ogni call dura 45 minuti.'
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-slate-700">{range}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setWeekStart((current) => addDays(current, -7))}>
            Settimana precedente
          </Button>
          <Button variant="secondary" onClick={() => setWeekStart(mondayOf(new Date()))}>
            Oggi
          </Button>
          <Button variant="secondary" onClick={() => setWeekStart((current) => addDays(current, 7))}>
            Settimana successiva
          </Button>
        </div>
      </div>

      <p className="mb-4 text-sm text-slate-500">
        In ogni giornata entrano {capacity} call: {slots.map((slot) => `${formatClock(slot.startMin)}–${formatClock(slot.endMin)}`).join(' e ')}.
        Un orario già preso non si può riusare.
      </p>

      <div className="space-y-3">
        {days.map((day) => {
          const taken = slots.filter((slot) => bookingOn(bookings, day, slot)).length
          const full = taken >= capacity
          const today = isSameLocalDay(day, new Date())
          return (
            <article
              key={day.toISOString()}
              className={`rounded-xl border bg-white p-3 shadow-sm ${today ? 'border-indigo-300' : 'border-slate-200'}`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold capitalize text-slate-900">{dayTitle.format(day)}</h2>
                <span className={`text-xs font-medium ${full ? 'text-slate-500' : 'text-indigo-700'}`}>
                  {full ? 'Completo' : `${taken}/${capacity} posti`}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {slots.map((slot) => {
                  const booking = bookingOn(bookings, day, slot)
                  const bounds = slotBounds(day, slot)
                  const past = bounds.starts.getTime() <= Date.now()
                  const clock = `${formatClock(slot.startMin)}–${formatClock(slot.endMin)}`
                  const mine = booking?.user_id === profile.id
                  const person = people.find((item) => item.id === booking?.user_id)
                  const company = companiesQuery.data?.find((item) => item.id === booking?.company_id)
                  const canSeeDetails = Boolean(booking && (isAdmin || mine))
                  const canCancel = Boolean(booking && (isAdmin || mine))
                  return (
                    <div key={slot.startMin} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{clock}</p>
                        {booking ? (
                          <p className="truncate text-sm text-slate-600">
                            {canSeeDetails ? `${company?.name ?? 'Azienda'} · ${person?.full_name ?? 'Collaboratore'}` : 'Occupato'}
                          </p>
                        ) : past ? (
                          <p className="text-xs text-slate-400">Passato</p>
                        ) : (
                          <p className="text-xs text-slate-500">Libero</p>
                        )}
                      </div>
                      {booking && canCancel ? (
                        <Button
                          variant="secondary"
                          className="!min-h-0 !px-2.5 !py-1 !text-xs"
                          disabled={cancel.isPending}
                          onClick={() => cancel.mutate(booking.id)}
                        >
                          Annulla
                        </Button>
                      ) : null}
                      {!booking && !past ? (
                        <Button
                          className="!min-h-0 !px-2.5 !py-1 !text-xs"
                          disabled={full || book.isPending}
                          onClick={() => openDraft(day, slot)}
                        >
                          Prenota
                        </Button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </article>
          )
        })}
      </div>

      <Modal
        open={draft !== null}
        title="Prenota call di spiegazione"
        description={draft?.label}
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              Chiudi
            </Button>
            <Button
              loading={book.isPending}
              disabled={!companyId || !draft}
              onClick={() => {
                if (!draft || !companyId) return
                book.mutate(
                  { companyId, startsAt: draft.startsAt },
                  { onSuccess: () => setDraft(null) },
                )
              }}
            >
              Conferma
            </Button>
          </>
        }
      >
        {companies.length === 0 ? (
          <p className="text-sm text-slate-600">Non hai aziende da associare alla call.</p>
        ) : (
          <Select label="Azienda" value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name} · {company.city}
              </option>
            ))}
          </Select>
        )}
      </Modal>
    </section>
  )
}
