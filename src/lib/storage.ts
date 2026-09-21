import type { Owner } from './config'
import type { PersonOwner } from './owners'
import type { GCalEvent } from './gcal'
import { DEFAULT_CUSTOM_COLORS, type Accent, type CustomColors, type Theme } from './theme'

/**
 * Ajustes en localStorage. Se guardan **por cuenta de Google**, asi cada uno
 * tiene su tema, su acento y sus calendarios sin pisar al otro, incluso si los
 * dos entran alguna vez desde el mismo movil.
 */
export interface CalendarLink {
  id: string
  /** Nombre del calendario en Google. */
  summary: string
  /** Nombre que se muestra en la app. Editable; por defecto, el de Google. */
  label: string
  editable: boolean
}

export interface Settings {
  /** Nombre de la app, editable en los ajustes. */
  appName: string
  /**
   * Cual de los dos carriles personales es la persona que ha entrado. Es lo
   * que hace que en cada movil se vea "Yo" en el calendario correcto: los
   * carriles son fijos, pero quien los mira no.
   */
  me: PersonOwner
  calendars: Partial<Record<Owner, CalendarLink>>
  /** Filtros activos en las vistas. */
  visible: Record<Owner, boolean>
  /** Minutos de aviso por defecto al crear un evento. */
  defaultReminders: number[]
  /** Duracion minima de un hueco para que se considere aprovechable. */
  minFreeSlotMinutes: number
  theme: Theme
  accent: Accent
  /** Solo se usan con el tema «A mi gusto». */
  customColors: CustomColors
  /** Intercambia los dos colores de persona dentro del tema elegido. */
  swapPeople: boolean
}

export const DEFAULT_APP_NAME = 'Nuestro calendario'

export const DEFAULT_SETTINGS: Settings = {
  appName: DEFAULT_APP_NAME,
  me: 'mine',
  calendars: {},
  visible: { mine: true, hers: true, ours: true },
  defaultReminders: [30],
  minFreeSlotMinutes: 60,
  theme: 'system',
  accent: 'azul',
  customColors: DEFAULT_CUSTOM_COLORS,
  swapPeople: false,
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
      customColors: { ...DEFAULT_CUSTOM_COLORS, ...parsed.customColors },
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
