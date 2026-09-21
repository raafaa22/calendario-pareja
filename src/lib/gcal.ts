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
 * previsto: se invalida y se reintenta una vez con uno nuevo.
 */
async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })

  if (res.status === 401 && retry) {
    invalidateToken()
    return api<T>(path, init, false)
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

export async function createCalendar(summary: string): Promise<GCalCalendar> {
  return api<GCalCalendar>('/calendars', {
    method: 'POST',
    body: JSON.stringify({ summary, timeZone: localTimeZone() }),
  })
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
 * Eventos de un calendario en un rango. `singleEvents` expande las series, que
 * es lo que interesa para pintar una rejilla: cada clase semanal llega como una
 * ocurrencia con su propia fecha.
 */
export async function listEvents(
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<GCalEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '2500',
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
