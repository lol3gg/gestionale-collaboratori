export const EXPLANATION_MINUTES = 45
export const DAY_START_MINUTES = 17 * 60 + 30
export const DAY_END_MINUTES = 19 * 60 + 30

export type SlotMinutes = {
  startMin: number
  endMin: number
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

export function startOfLocalDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
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

export function assertBookableSlot(startsAt: string): { starts: Date; ends: Date } {
  const starts = new Date(startsAt)
  if (Number.isNaN(starts.getTime())) throw new Error('Orario non valido')
  if (starts.getSeconds() !== 0 || starts.getMilliseconds() !== 0) throw new Error('Orario non valido')
  const startMin = starts.getHours() * 60 + starts.getMinutes()
  const slot = explanationSlots().find((item) => item.startMin === startMin)
  if (!slot) throw new Error('Questo orario non rientra nella disponibilità')
  const ends = new Date(starts.getTime() + EXPLANATION_MINUTES * 60 * 1000)
  if (ends.getHours() * 60 + ends.getMinutes() !== slot.endMin) {
    throw new Error('La call non rientra nella disponibilità')
  }
  if (starts.getTime() <= Date.now()) throw new Error('Non puoi prenotare un orario già passato')
  return { starts, ends }
}
