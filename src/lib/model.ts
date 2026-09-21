import type { GCalEvent } from './gcal'
import type { Owner } from './config'
import { parseDescription } from './tags'
import { parseRecurrence, type RecurrenceSpec } from './recurrence'

/**
 * Evento ya masticado: fechas como Date, etiquetas separadas de las notas y el
 * calendario al que pertenece resuelto a "mio / suyo / nuestro". Todas las
 * vistas trabajan con esto, no con la respuesta cruda de Google.
 */
export interface AppEvent {
  id: string
  calendarId: string
  owner: Owner
  title: string
  notes: string
  tags: string[]
  location?: string
  start: Date
  end: Date
  allDay: boolean
  /** Presente si esta ocurrencia pertenece a una serie recurrente. */
  seriesId?: string
  recurrence: RecurrenceSpec
  reminders: number[]
  htmlLink?: string
  /** false cuando el calendario es de solo lectura para la cuenta actual. */
  editable: boolean
}

export function toAppEvent(
  raw: GCalEvent,
  calendarId: string,
  owner: Owner,
  editable: boolean,
): AppEvent {
  const allDay = Boolean(raw.start.date)
  const { notes, tags } = parseDescription(raw.description)

  return {
    id: raw.id,
    calendarId,
    owner,
    title: raw.summary?.trim() || '(sin título)',
    notes,
    tags,
    location: raw.location,
    start: parseGCalDate(raw.start, false),
    end: parseGCalDate(raw.end, allDay),
    allDay,
    seriesId: raw.recurringEventId,
    recurrence: parseRecurrence(raw.recurrence),
    reminders: raw.reminders?.overrides?.map((o) => o.minutes) ?? [],
    htmlLink: raw.htmlLink,
    editable,
  }
}

/**
 * Los eventos de dia completo llegan como `date` y su fin es exclusivo (un
 * evento de un dia acaba al dia siguiente). Se resta un instante para que al
 * pintar no invada el dia de despues.
 */
function parseGCalDate(d: { date?: string; dateTime?: string }, isExclusiveEnd: boolean): Date {
  if (d.dateTime) return new Date(d.dateTime)
  if (d.date) {
    const [y, m, day] = d.date.split('-').map(Number)
    const parsed = new Date(y, m - 1, day)
    if (isExclusiveEnd) parsed.setMilliseconds(parsed.getMilliseconds() - 1)
    return parsed
  }
  return new Date()
}

/** ¿El evento ocupa algo de este dia? Cubre eventos de varios dias. */
export function occursOn(ev: AppEvent, day: Date): boolean {
  const from = new Date(day.getFullYear(), day.getMonth(), day.getDate())
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000 - 1)
  return ev.start <= to && ev.end >= from
}

/** Ordena por hora de inicio, poniendo los de dia completo arriba. */
export function byStart(a: AppEvent, b: AppEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
  return a.start.getTime() - b.start.getTime()
}
