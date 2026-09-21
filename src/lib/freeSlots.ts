import { DAY_WINDOW } from './config'
import type { AppEvent } from './model'

/**
 * Huecos en los que nadie tiene nada. Es la pieza que responde a "cuando
 * podemos quedar": une lo ocupado de los dos y devuelve lo que queda libre
 * dentro de la franja util del dia.
 */

export interface FreeSlot {
  start: Date
  end: Date
  minutes: number
}

interface Interval {
  start: number
  end: number
}

export function freeSlotsForDay(
  day: Date,
  events: AppEvent[],
  minMinutes: number,
): FreeSlot[] {
  const windowStart = new Date(day)
  windowStart.setHours(DAY_WINDOW.startHour, 0, 0, 0)
  const windowEnd = new Date(day)
  windowEnd.setHours(DAY_WINDOW.endHour, 0, 0, 0)

  // Un evento de dia completo bloquea el dia entero: no hay hueco que ofrecer.
  if (events.some((e) => e.allDay && overlapsDay(e, windowStart, windowEnd))) return []

  const busy: Interval[] = events
    .filter((e) => !e.allDay)
    .map((e) => ({
      start: Math.max(e.start.getTime(), windowStart.getTime()),
      end: Math.min(e.end.getTime(), windowEnd.getTime()),
    }))
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start)

  const merged = mergeIntervals(busy)

  const slots: FreeSlot[] = []
  let cursor = windowStart.getTime()

  for (const b of merged) {
    if (b.start > cursor) push(slots, cursor, b.start, minMinutes)
    cursor = Math.max(cursor, b.end)
  }
  if (cursor < windowEnd.getTime()) push(slots, cursor, windowEnd.getTime(), minMinutes)

  return slots
}

function overlapsDay(e: AppEvent, from: Date, to: Date): boolean {
  return e.start <= to && e.end >= from
}

function push(out: FreeSlot[], start: number, end: number, minMinutes: number) {
  const minutes = Math.round((end - start) / 60000)
  if (minutes >= minMinutes) out.push({ start: new Date(start), end: new Date(end), minutes })
}

function mergeIntervals(sorted: Interval[]): Interval[] {
  const out: Interval[] = []
  for (const cur of sorted) {
    const last = out[out.length - 1]
    if (last && cur.start <= last.end) last.end = Math.max(last.end, cur.end)
    else out.push({ ...cur })
  }
  return out
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}
