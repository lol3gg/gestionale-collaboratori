import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Input, Select } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import {
  useAddExplanationExtraSlot,
  useBookExplanation,
  useCancelExplanation,
  useExplanationBookings,
  useExplanationExtraSlots,
  useRemoveExplanationExtraSlot,
} from '../hooks/useCalendar'
import { useCompanies } from '../hooks/useCompanies'
import { useCollaborators } from '../hooks/useCollaborators'
import { useProfile } from '../hooks/useProfile'
import {
  EXTRA_SLOT_EARLIEST,
  EXTRA_SLOT_LATEST,
  EXPLANATION_MINUTES,
  addDays,
  formatClock,
  isSameLocalDay,
  localDateKey,
  mondayOf,
  parseClockToMinutes,
  slotBounds,
  slotsForDay,
  startOfLocalDay,
  type DaySlot,
} from '../lib/calendar'
import { errorMessage } from '../lib/validators'
import type { ExplanationBooking } from '../types'

const dayTitle = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
const weekTitle = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' })
const weekTitleYear = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
const slotTitle = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })

function bookingOn(bookings: ExplanationBooking[], day: Date, slot: DaySlot): ExplanationBooking | null {
  const { starts } = slotBounds(day, slot)
  return bookings.find((booking) => new Date(booking.starts_at).getTime() === starts.getTime()) ?? null
}

export function CalendarioPage() {
  const { profile, loading } = useProfile()
  const [searchParams] = useSearchParams()
  const preferredCompanyId = searchParams.get('companyId') ?? ''
  const bookingsQuery = useExplanationBookings(profile)
  const extrasQuery = useExplanationExtraSlots(profile)
  const companiesQuery = useCompanies(profile)
  const peopleQuery = useCollaborators()
  const book = useBookExplanation(profile)
  const cancel = useCancelExplanation(profile)
  const addExtra = useAddExplanationExtraSlot(profile)
  const removeExtra = useRemoveExplanationExtraSlot(profile)
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [draft, setDraft] = useState<{ startsAt: string; label: string } | null>(null)
  const [companyId, setCompanyId] = useState(preferredCompanyId)
  const [extraDraft, setExtraDraft] = useState<{ day: Date; time: string } | null>(null)

  const todayStart = startOfLocalDay(new Date())
  const currentWeekStart = mondayOf(todayStart)
  const todayMs = todayStart.getTime()
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)).filter(
        (day) => startOfLocalDay(day).getTime() >= todayMs,
      ),
    [weekStart, todayMs],
  )
  const canGoPrev = weekStart.getTime() > currentWeekStart.getTime()
  const companies = useMemo(
    () => [...(companiesQuery.data ?? [])].sort((left, right) => left.name.localeCompare(right.name, 'it')),
    [companiesQuery.data],
  )
  const preferredCompany = companies.find((item) => item.id === preferredCompanyId) ?? null
  const people = peopleQuery.data ?? []
  const bookings = bookingsQuery.data ?? []
  const extras = extrasQuery.data ?? []
  const isAdmin = profile?.role === 'admin'
  const defaultSlotsLabel = slotsForDay(todayStart, [])
    .map((slot) => `${formatClock(slot.startMin)}–${formatClock(slot.endMin)}`)
    .join(' e ')

  useEffect(() => {
    if (!preferredCompanyId) return
    setCompanyId(preferredCompanyId)
  }, [preferredCompanyId])

  function openDraft(day: Date, slot: DaySlot) {
    const bounds = slotBounds(day, slot)
    const preferred = companies.find((item) => item.id === preferredCompanyId)
    const first = preferred ?? companies[0]
    setCompanyId(first?.id ?? '')
    setDraft({
      startsAt: bounds.starts.toISOString(),
      label: `${slotTitle.format(bounds.starts)}, ${formatClock(slot.startMin)}–${formatClock(slot.endMin)}`,
    })
  }

  function openExtraDraft(day: Date) {
    setExtraDraft({ day, time: '16:00' })
  }

  if (loading || !profile || bookingsQuery.isPending || extrasQuery.isPending || companiesQuery.isPending) {
    return (
      <section>
        <PageHeader title="Calendario" />
        <div className="flex justify-center py-24">
          <Spinner className="h-8 w-8 text-primary-600" />
        </div>
      </section>
    )
  }

  if (bookingsQuery.isError || extrasQuery.isError || companiesQuery.isError) {
    return (
      <section>
        <PageHeader title="Calendario" />
        <EmptyState
          title="Impossibile caricare il calendario"
          description={errorMessage(bookingsQuery.error ?? extrasQuery.error ?? companiesQuery.error)}
          action={
            <Button
              onClick={() => {
                void bookingsQuery.refetch()
                void extrasQuery.refetch()
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

  const rangeStart = days[0] ?? weekStart
  const rangeEnd = days[days.length - 1] ?? addDays(weekStart, 6)
  const range = `${weekTitle.format(rangeStart)} – ${weekTitleYear.format(rangeEnd)}`

  return (
    <section>
      <PageHeader
        title="Calendario"
        description={
          isAdmin
            ? 'Disponibilità per le call di spiegazione. Ogni call dura 45 minuti. Puoi aggiungere orari extra oltre a quelli predefiniti.'
            : 'Fissa una call di spiegazione con l’admin. Ogni call dura 45 minuti.'
        }
      />

      {preferredCompany ? (
        <div className="mb-4 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-[15px] text-primary-900">
          Scegli data e orario per <span className="font-semibold">{preferredCompany.name}</span>. Premi{' '}
          <span className="font-semibold">Prenota</span> sullo slot libero.
        </div>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-slate-700">{range}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={!canGoPrev}
            onClick={() => setWeekStart((current) => addDays(current, -7))}
          >
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

      <p className="mb-4 text-[15px] text-muted">
        Orari predefiniti ogni giorno: {defaultSlotsLabel}. Un orario già preso non si può riusare.
        {isAdmin
          ? ` Come admin puoi aggiungere altri slot (da ${formatClock(EXTRA_SLOT_EARLIEST)} a ${formatClock(EXTRA_SLOT_LATEST)}, durata ${EXPLANATION_MINUTES} minuti).`
          : ''}
      </p>

      <div className="space-y-3">
        {days.length === 0 ? (
          <EmptyState
            title="Nessun giorno disponibile"
            description="Passa alla settimana successiva per vedere le disponibilità."
          />
        ) : null}
        {days.map((day) => {
          const daySlots = slotsForDay(day, extras)
          const taken = daySlots.filter((slot) => bookingOn(bookings, day, slot)).length
          const capacity = daySlots.length
          const full = taken >= capacity
          const today = isSameLocalDay(day, new Date())
          return (
            <article
              key={day.toISOString()}
              className={`card-surface p-4 ${today ? 'border-primary-300' : ''}`}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[15px] font-semibold capitalize tracking-tight text-ink">{dayTitle.format(day)}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs font-medium ${full ? 'text-muted' : 'text-primary-700'}`}>
                    {full ? 'Completo' : `${taken}/${capacity} posti`}
                  </span>
                  {isAdmin ? (
                    <Button variant="secondary" className="min-h-11 px-3 text-sm" onClick={() => openExtraDraft(day)}>
                      Aggiungi orario
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {daySlots.map((slot) => {
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
                    <div
                      key={`${slot.startMin}-${slot.extraId ?? 'base'}`}
                      className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-canvas px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold tabular-nums text-ink">
                          {clock}
                          {slot.isExtra ? (
                            <span className="ml-2 align-middle text-xs font-medium text-primary-700">Extra</span>
                          ) : null}
                        </p>
                        {booking ? (
                          <p className="truncate text-[15px] text-muted">
                            {canSeeDetails
                              ? `${company?.name ?? 'Azienda'} · ${person?.full_name ?? 'Collaboratore'}`
                              : 'Occupato'}
                          </p>
                        ) : past ? (
                          <p className="text-xs text-muted">Passato</p>
                        ) : (
                          <p className="text-xs text-muted">Libero</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {booking && canCancel ? (
                          <Button
                            variant="secondary"
                            className="min-h-11 px-3 text-sm"
                            disabled={cancel.isPending}
                            onClick={() => cancel.mutate(booking.id)}
                          >
                            Annulla
                          </Button>
                        ) : null}
                        {!booking && !past ? (
                          <Button
                            className="min-h-11 px-3 text-sm"
                            disabled={full || book.isPending}
                            onClick={() => openDraft(day, slot)}
                          >
                            Prenota
                          </Button>
                        ) : null}
                        {isAdmin && slot.isExtra && slot.extraId && !booking ? (
                          <Button
                            variant="ghost"
                            className="min-h-11 px-3 text-sm"
                            disabled={removeExtra.isPending}
                            onClick={() => removeExtra.mutate(slot.extraId!)}
                          >
                            Rimuovi
                          </Button>
                        ) : null}
                      </div>
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

      <Modal
        open={extraDraft !== null}
        title="Aggiungi orario"
        description={
          extraDraft
            ? `${slotTitle.format(extraDraft.day)} · durata ${EXPLANATION_MINUTES} minuti`
            : undefined
        }
        onClose={() => setExtraDraft(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setExtraDraft(null)}>
              Chiudi
            </Button>
            <Button
              loading={addExtra.isPending}
              disabled={!extraDraft?.time}
              onClick={() => {
                if (!extraDraft) return
                const startMin = parseClockToMinutes(extraDraft.time)
                if (startMin === null) return
                addExtra.mutate(
                  { dateKey: localDateKey(extraDraft.day), startMin },
                  { onSuccess: () => setExtraDraft(null) },
                )
              }}
            >
              Aggiungi
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <Input
            label="Ora di inizio"
            type="time"
            step={900}
            min={formatClock(EXTRA_SLOT_EARLIEST)}
            max={formatClock(EXTRA_SLOT_LATEST - EXPLANATION_MINUTES)}
            value={extraDraft?.time ?? ''}
            onChange={(event) =>
              setExtraDraft((current) => (current ? { ...current, time: event.target.value } : current))
            }
          />
          <p className="text-sm text-muted">
            Tra {formatClock(EXTRA_SLOT_EARLIEST)} e {formatClock(EXTRA_SLOT_LATEST - EXPLANATION_MINUTES)}, a
            scatti di 15 minuti.
          </p>
        </div>
      </Modal>
    </section>
  )
}
