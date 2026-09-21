import { getToken, invalidateToken } from './auth'

const BASE = 'https://www.googleapis.com/calendar/v3'

export interface GCalDateTime {
  date?: string
  dateTime?: string
  timeZone?: string
}

export interface GCalReminderOverride {
  method: 'popup' | 'email'
  minutes: number
}

export interface GCalEvent {
  id: string
  status?: string
  summary?: string
  description?: string
  location?: string
  start: GCalDateTime
  end: GCalDateTime
  recurrence?: string[]
  recurringEventId?: string
  reminders?: {
    useDefault?: boolean
    overrides?: GCalReminderOverride[]
  }
  htmlLink?: string
}

export interface GCalCalendar {
  id: string
  summary: string
  description?: string
  primary?: boolean
  accessRole: string
  backgroundColor?: string
}

export class GCalError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

/**
 * Llamada a la API. Si Google responde 401 el token ha caducado antes de lo
 * previsto: se invalida, lo que hace que la app vuelva a la pantalla de
 * entrada, y se corta aqui.
 */
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })

  if (res.status === 401) {
    invalidateToken()
    throw new GCalError('La sesión ha caducado. Vuelve a entrar con Google.', 401)
  }

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = (await res.json()) as { error?: { message?: string } }
      detail = body.error?.message ?? detail
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    throw new GCalError(detail, res.status)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export async function listCalendars(): Promise<GCalCalendar[]> {
  const res = await api<{ items?: GCalCalendar[] }>(
    '/users/me/calendarList?minAccessRole=reader&maxResults=250',
  )
  return res.items ?? []
}

/** Cambia los datos de un calendario que sea tuyo (nombre, descripcion…). */
export async function updateCalendar(
  calendarId: string,
  patch: { summary?: string; description?: string },
): Promise<GCalCalendar> {
  return api<GCalCalendar>(`/calendars/${encodeURIComponent(calendarId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

/**
 * Anade a la lista del usuario un calendario al que ya tiene acceso, sabiendo
 * su ID. Es lo que resuelve el caso de "me lo ha compartido pero no me sale":
 * compartir da permiso, pero Google no siempre lo mete en la lista del otro
 * hasta que acepta el correo de invitacion.
 *
 * Falla con 404 si todavia no tiene permiso sobre ese calendario.
 */
export async function addCalendarToList(calendarId: string): Promise<GCalCalendar> {
  return api<GCalCalendar>('/users/me/calendarList', {
    method: 'POST',
    body: JSON.stringify({ id: calendarId }),
  })
}

export async function createCalendar(
  summary: string,
  description?: string,
): Promise<GCalCalendar> {
  return api<GCalCalendar>('/calendars', {
    method: 'POST',
    body: JSON.stringify({ summary, description, timeZone: localTimeZone() }),
  })
}

/** Cuantos eventos tiene un calendario. Para saber que se pierde al borrarlo. */
export async function countEvents(calendarId: string): Promise<number> {
  const params = new URLSearchParams({
    singleEvents: 'false',
    maxResults: '250',
    fields: 'items/id',
  })
  const res = await api<{ items?: { id: string }[] }>(
    `/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
  )
  return res.items?.length ?? 0
}

/**
 * Borra un calendario de la cuenta, con todos sus eventos. Irreversible: solo
 * se llama desde un boton con doble confirmacion.
 */
export async function deleteCalendar(calendarId: string): Promise<void> {
  await api(`/calendars/${encodeURIComponent(calendarId)}`, { method: 'DELETE' })
}

/**
 * Comparte un calendario con otra cuenta. `writer` permite crear y editar
 * eventos; `reader` solo consultar.
 */
export async function shareCalendar(
  calendarId: string,
  email: string,
  role: 'reader' | 'writer' = 'writer',
): Promise<void> {
  await api(`/calendars/${encodeURIComponent(calendarId)}/acl`, {
    method: 'POST',
    body: JSON.stringify({ role, scope: { type: 'user', value: email } }),
  })
}

/**
 * Eventos de un calendario en un rango. Por defecto expande las series, que es
 * lo que interesa para pintar una rejilla: cada clase semanal llega como una
 * ocurrencia con su propia fecha. Con `expandSeries: false` llegan los eventos
 * maestros con su RRULE, que es lo que hay que tocar para editar una serie.
 */
export async function listEvents(
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
  opts: { expandSeries?: boolean } = {},
): Promise<GCalEvent[]> {
  const expand = opts.expandSeries !== false
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: String(expand),
    maxResults: '2500',
    // orderBy=startTime solo vale con las series expandidas.
    ...(expand ? { orderBy: 'startTime' } : {}),
  })
  const res = await api<{ items?: GCalEvent[] }>(
    `/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
  )
  // Google devuelve las instancias canceladas de una serie: no deben pintarse.
  return (res.items ?? []).filter((e) => e.status !== 'cancelled')
}

export async function getEvent(calendarId: string, eventId: string): Promise<GCalEvent> {
  return api<GCalEvent>(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
  )
}

export async function createEvent(
  calendarId: string,
  body: Partial<GCalEvent>,
): Promise<GCalEvent> {
  return api<GCalEvent>(`/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function patchEvent(
  calendarId: string,
  eventId: string,
  body: Partial<GCalEvent>,
): Promise<GCalEvent> {
  return api<GCalEvent>(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  )
}

export async function deleteEvent(calendarId: string, eventId: string): Promise<void> {
  await api(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' },
  )
}

export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid'
}
