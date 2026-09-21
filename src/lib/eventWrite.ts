import type { Owner } from './config'
import { createEvent, deleteEvent, getEvent, localTimeZone, patchEvent, type GCalEvent } from './gcal'
import type { AppEvent } from './model'
import { buildRecurrence, type RecurrenceSpec } from './recurrence'
import { buildDescription } from './tags'

/** Lo que el formulario devuelve al guardar. */
export interface EventDraft {
  title: string
  owner: Owner
  allDay: boolean
  start: Date
  end: Date
  notes: string
  tags: string[]
  location: string
  reminders: number[]
  recurrence: RecurrenceSpec
}

/** Al editar una ocurrencia de una serie hay que saber a que se aplica. */
export type EditScope = 'instance' | 'series'

/**
 * `recurrence: null` en el cuerpo de un PATCH es como se le dice a Google que
 * borre la regla de un evento que antes se repetia. El tipo de la API no lo
 * admite, de ahi el casteo.
 */
type WriteBody = Partial<Omit<GCalEvent, 'recurrence'>> & { recurrence?: string[] | null }

function toBody(draft: EventDraft, withRecurrence: boolean): WriteBody {
  const tz = localTimeZone()

  const body: WriteBody = {
    summary: draft.title.trim() || 'Sin título',
    description: buildDescription(draft.notes, draft.tags) || undefined,
    location: draft.location.trim() || undefined,
    // useDefault false con overrides vacio = evento sin avisos, a proposito.
    reminders: {
      useDefault: false,
      overrides: draft.reminders.map((minutes) => ({ method: 'popup' as const, minutes })),
    },
  }

  if (draft.allDay) {
    // En eventos de dia completo el fin es exclusivo: uno de un solo dia
    // termina en la fecha siguiente.
    body.start = { date: isoDate(draft.start) }
    body.end = { date: isoDate(addDays(draft.end, 1)) }
  } else {
    body.start = { dateTime: draft.start.toISOString(), timeZone: tz }
    body.end = { dateTime: draft.end.toISOString(), timeZone: tz }
  }

  if (withRecurrence) {
    body.recurrence = buildRecurrence(draft.recurrence, draft.start) ?? null
  }

  return body
}

function send(calendarId: string, body: WriteBody, eventId?: string) {
  const payload = body as Partial<GCalEvent>
  return eventId
    ? patchEvent(calendarId, eventId, payload)
    : createEvent(calendarId, payload)
}

export function saveNewEvent(calendarId: string, draft: EventDraft): Promise<GCalEvent> {
  return send(calendarId, toBody(draft, true))
}

/**
 * Guarda cambios sobre un evento existente.
 *
 * - `instance`: toca solo esa ocurrencia. Google la convierte en excepcion de
 *   la serie por su cuenta, sin alterar el resto.
 * - `series`: toca el evento maestro. La hora se traslada conservando la fecha
 *   de inicio original de la serie, igual que hace la app de Google: cambiar
 *   "los martes a las 18:00" no debe mover el comienzo de la serie.
 */
export async function saveExistingEvent(
  original: AppEvent,
  draft: EventDraft,
  scope: EditScope,
  targetCalendarId: string,
): Promise<void> {
  if (targetCalendarId !== original.calendarId) {
    // Cambiar de persona es cambiar de calendario. Mover una serie entre
    // calendarios no es fiable en la API, asi que se recrea y se borra.
    await saveNewEvent(targetCalendarId, draft)
    await deleteEventFor(original, scope)
    return
  }

  if (scope === 'instance' || !original.seriesId) {
    // Una ocurrencia concreta nunca lleva RRULE propio.
    await send(original.calendarId, toBody(draft, !original.seriesId), original.id)
    return
  }

  const master = await getEvent(original.calendarId, original.seriesId)
  const body = toBody(draft, true)

  if (!draft.allDay && master.start.dateTime) {
    const tz = localTimeZone()
    const durationMs = draft.end.getTime() - draft.start.getTime()
    const newStart = withTimeOf(new Date(master.start.dateTime), draft.start)
    body.start = { dateTime: newStart.toISOString(), timeZone: tz }
    body.end = {
      dateTime: new Date(newStart.getTime() + durationMs).toISOString(),
      timeZone: tz,
    }
  }

  await send(original.calendarId, body, original.seriesId)
}

export function deleteEventFor(ev: AppEvent, scope: EditScope): Promise<void> {
  const id = scope === 'series' && ev.seriesId ? ev.seriesId : ev.id
  return deleteEvent(ev.calendarId, id)
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

/** Coge el dia de `base` y la hora de `time`. */
function withTimeOf(base: Date, time: Date): Date {
  const out = new Date(base)
  out.setHours(time.getHours(), time.getMinutes(), 0, 0)
  return out
}
