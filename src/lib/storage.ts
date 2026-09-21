import type { Owner } from './config'
import type { GCalEvent } from './gcal'
import type { Accent, Theme } from './theme'

/**
 * Ajustes en localStorage. Se guardan **por cuenta de Google**, asi cada uno
 * tiene su tema, su acento y sus calendarios sin pisar al otro, incluso si los
 * dos entran alguna vez desde el mismo movil.
 */
export interface CalendarLink {
  id: string
  summary: string
  editable: boolean
}

export interface Settings {
  calendars: Partial<Record<Owner, CalendarLink>>
  /** Filtros activos en las vistas. */
  visible: Record<Owner, boolean>
  /** Minutos de aviso por defecto al crear un evento. */
  defaultReminders: number[]
  /** Duracion minima de un hueco para que se considere aprovechable. */
  minFreeSlotMinutes: number
  theme: Theme
  accent: Accent
}

export const DEFAULT_SETTINGS: Settings = {
  calendars: {},
  visible: { mine: true, hers: true, ours: true },
  defaultReminders: [30],
  minFreeSlotMinutes: 60,
  theme: 'system',
  accent: 'azul',
}

const PREFIX = 'cp.settings'

/**
 * Clave de los ajustes de una cuenta. Sin correo se usa una clave suelta, que
 * es la que se lee en el arranque antes de saber quien entra; cuando llega el
 * perfil se migra a la clave de la cuenta.
 */
function keyFor(email?: string | null): string {
  return email ? `${PREFIX}.${email.toLowerCase()}` : PREFIX
}

export function loadSettings(email?: string | null): Settings {
  const stored = readAt(keyFor(email))
  // Primera vez con esta cuenta: se heredan los ajustes sueltos del arranque
  // para no perder el tema que ya se estaba usando.
  if (!stored && email) return readAt(keyFor(null)) ?? DEFAULT_SETTINGS
  return stored ?? DEFAULT_SETTINGS
}

function readAt(key: string): Settings | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      visible: { ...DEFAULT_SETTINGS.visible, ...parsed.visible },
      calendars: parsed.calendars ?? {},
    }
  } catch {
    return null
  }
}

export function saveSettings(s: Settings, email?: string | null): void {
  try {
    localStorage.setItem(keyFor(email), JSON.stringify(s))
  } catch {
    /* cuota llena o modo privado: la app sigue funcionando en memoria */
  }
}

export function isConfigured(s: Settings): boolean {
  return Boolean(s.calendars.mine && s.calendars.hers && s.calendars.ours)
}

/**
 * Cache de eventos para modo sin conexion. El service worker ya cachea las
 * respuestas HTTP, pero esto permite pintar algo al instante en el primer
 * render, antes de que la peticion vuelva.
 */
const CACHE_KEY = 'cp.events'

export function cacheEvents(calendarId: string, events: GCalEvent[]): void {
  try {
    const all = readCache()
    all[calendarId] = { at: Date.now(), events }
    localStorage.setItem(CACHE_KEY, JSON.stringify(all))
  } catch {
    /* sin cache local, solo se pierde el render instantaneo */
  }
}

export function readCachedEvents(calendarId: string): GCalEvent[] {
  return readCache()[calendarId]?.events ?? []
}

function readCache(): Record<string, { at: number; events: GCalEvent[] }> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function clearEventCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* nada que limpiar */
  }
}
