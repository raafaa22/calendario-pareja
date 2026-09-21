import type { Owner } from './config'
import type { GCalEvent } from './gcal'

/**
 * Ajustes en localStorage: que calendario de Google corresponde a cada uno de
 * los tres carriles de la app. Es lo unico que la app necesita recordar.
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
}

const KEY = 'cp.settings'

export const DEFAULT_SETTINGS: Settings = {
  calendars: {},
  visible: { mine: true, hers: true, ours: true },
  defaultReminders: [30],
  minFreeSlotMinutes: 60,
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      visible: { ...DEFAULT_SETTINGS.visible, ...parsed.visible },
      calendars: parsed.calendars ?? {},
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
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
