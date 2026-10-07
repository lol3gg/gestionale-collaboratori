export const EXPLANATION_MINUTES = 45
export const DAY_START_MINUTES = 17 * 60 + 30
export const DAY_END_MINUTES = 19 * 60 + 30
/** Finestra in cui l’admin può aggiungere orari extra (oltre i predefiniti). */
export const EXTRA_SLOT_EARLIEST = 8 * 60
export const EXTRA_SLOT_LATEST = 21 * 60

export type SlotMinutes = {
  startMin: number
  endMin: number
}

export type DaySlot = SlotMinutes & {
  isExtra: boolean
  extraId?: string
}

export type ExtraSlotLike = {
  id: string
  date_key: string
  start_min: number
}

export function explanationSlots(): SlotMinutes[] {
  const slots: SlotMinutes[] = []
  for (let start = DAY_START_MINUTES; start + EXPLANATION_MINUTES <= DAY_END_MINUTES; start += EXPLANATION_MINUTES) {
    slots.push({ startMin: start, endMin: start + EXPLANATION_MINUTES })
  }
  return slots
}

export function formatClock(minutes: number): string {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function parseClockToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return hour * 60 + minute
}

export function startOfLocalDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export function localDateKey(date: Date): string {
  const day = startOfLocalDay(date)
  const year = day.getFullYear()
  const month = String(day.getMonth() + 1).padStart(2, '0')
  const dayNum = String(day.getDate()).padStart(2, '0')
  return `${year}-${month}-${dayNum}`
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function mondayOf(date: Date): Date {
  const next = startOfLocalDay(date)
  const day = next.getDay()
  const distance = day === 0 ? 6 : day - 1
  next.setDate(next.getDate() - distance)
  return next
}

export function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

export function slotBounds(day: Date, slot: SlotMinutes): { starts: Date; ends: Date } {
  const starts = startOfLocalDay(day)
  starts.setHours(Math.floor(slot.startMin / 60), slot.startMin % 60, 0, 0)
  const ends = new Date(starts.getTime() + EXPLANATION_MINUTES * 60 * 1000)
  return { starts, ends }
}

export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart
}

export function slotsForDay(day: Date, extras: ExtraSlotLike[]): DaySlot[] {
  const key = localDateKey(day)
  const base: DaySlot[] = explanationSlots().map((slot) => ({
    ...slot,
    isExtra: false,
  }))
  const custom: DaySlot[] = extras
    .filter((item) => item.date_key === key)
    .map((item) => ({
      startMin: item.start_min,
      endMin: item.start_min + EXPLANATION_MINUTES,
      isExtra: true,
      extraId: item.id,
    }))

  const byStart = new Map<number, DaySlot>()
  for (const slot of base) byStart.set(slot.startMin, slot)
  for (const slot of custom) {
    if (!byStart.has(slot.startMin)) byStart.set(slot.startMin, slot)
  }
  return [...byStart.values()].sort((left, right) => left.startMin - right.startMin)
}

export function assertExtraSlot(day: Date, startMin: number, existing: DaySlot[]): SlotMinutes {
  if (!Number.isInteger(startMin) || startMin % 15 !== 0) {
    throw new Error('Scegli un orario a intervalli di 15 minuti')
  }
  if (startMin < EXTRA_SLOT_EARLIEST || startMin + EXPLANATION_MINUTES > EXTRA_SLOT_LATEST) {
    throw new Error(`L’orario deve stare tra ${formatClock(EXTRA_SLOT_EARLIEST)} e ${formatClock(EXTRA_SLOT_LATEST)}`)
  }
  if (startOfLocalDay(day).getTime() < startOfLocalDay(new Date()).getTime()) {
    throw new Error('Non puoi aggiungere orari in un giorno passato')
  }
  const endMin = startMin + EXPLANATION_MINUTES
  const overlaps = existing.some((slot) => rangesOverlap(startMin, endMin, slot.startMin, slot.endMin))
  if (overlaps) throw new Error('Questo orario si sovrappone a uno già presente')
  return { startMin, endMin }
}

export function assertBookableSlot(startsAt: string, allowedStartMins: number[]): { starts: Date; ends: Date } {
  const starts = new Date(startsAt)
  if (Number.isNaN(starts.getTime())) throw new Error('Orario non valido')
  if (starts.getSeconds() !== 0 || starts.getMilliseconds() !== 0) throw new Error('Orario non valido')
  const startMin = starts.getHours() * 60 + starts.getMinutes()
  if (!allowedStartMins.includes(startMin)) {
    throw new Error('Questo orario non rientra nella disponibilità')
  }
  const ends = new Date(starts.getTime() + EXPLANATION_MINUTES * 60 * 1000)
  if (starts.getTime() <= Date.now()) throw new Error('Non puoi prenotare un orario già passato')
  return { starts, ends }
}
