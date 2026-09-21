import type { GCalEvent } from './gcal'
import { ANNIVERSARY_TITLE, type Owner } from './config'
import { elapsedLabel } from './dates'
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
  /** El titulo tal cual esta en Google. Es el que se edita y se guarda. */
  title: string
  /**
   * El titulo tal como se ensena. Solo cambia en los aniversarios, que llevan
   * la cuenta de meses y años puesta aqui en vez de guardada en el evento.
   */
  displayTitle: string
  notes: string
  tags: string[]
  /** Emoji elegido a mano. Manda sobre el icono de la etiqueta. */
  emoji?: string
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
  const { notes, tags, emoji } = parseDescription(raw.description)

  const title = raw.summary?.trim() || '(sin título)'
  const start = parseGCalDate(raw.start, false)

  return {
    id: raw.id,
    calendarId,
    owner,
    title,
    // La cuenta se calcula por la fecha de ESTA repeticion, que es justo lo
    // que un evento recurrente no puede guardar en su nombre.
    displayTitle:
      title === ANNIVERSARY_TITLE ? `${title} ${elapsedLabel(start)}` : title,
    notes,
    tags,
    emoji,
    location: raw.location,
    start,
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
