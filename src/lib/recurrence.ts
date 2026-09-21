/**
 * Constructor de RRULE (RFC 5545). Google se encarga de expandir la regla, asi
 * que aqui solo hay que generar la cadena correcta y saber leerla de vuelta
 * para rellenar el formulario al editar.
 */

export type Freq = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'

/** Indices de getDay() de JS (0 = domingo) a codigos iCal. */
const ICAL_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const

export interface RecurrenceSpec {
  freq: Freq
  /** Solo para weekly y biweekly. Indices de getDay(): 0 = domingo. */
  byDay: number[]
  /** Fecha (sin hora) en la que deja de repetirse. Vacio = para siempre. */
  until?: string
}

export const NO_RECURRENCE: RecurrenceSpec = { freq: 'none', byDay: [] }

export const FREQ_LABELS: Record<Freq, string> = {
  none: 'No se repite',
  daily: 'Todos los días',
  weekly: 'Cada semana',
  biweekly: 'Semana sí, semana no',
  monthly: 'Cada mes',
  yearly: 'Cada año',
}

/**
 * Devuelve el array `recurrence` que espera la API de Google, o undefined si el
 * evento no se repite.
 */
export function buildRecurrence(spec: RecurrenceSpec, start: Date): string[] | undefined {
  if (spec.freq === 'none') return undefined

  const parts: string[] = []

  switch (spec.freq) {
    case 'daily':
      parts.push('FREQ=DAILY')
      break
    case 'weekly':
    case 'biweekly': {
      parts.push('FREQ=WEEKLY')
      if (spec.freq === 'biweekly') parts.push('INTERVAL=2')
      // Si no se marca ningun dia, se repite el dia de la semana del evento.
      const days = spec.byDay.length ? spec.byDay : [start.getDay()]
      parts.push(`BYDAY=${days.map((d) => ICAL_DAYS[d]).join(',')}`)
      break
    }
    case 'monthly':
      parts.push('FREQ=MONTHLY')
      break
    case 'yearly':
      parts.push('FREQ=YEARLY')
      break
  }

  if (spec.until) {
    // UNTIL debe ir en UTC. Se toma el final del dia elegido en hora local para
    // que la ultima repeticion caiga dentro y no se pierda por el desfase.
    const [y, m, d] = spec.until.split('-').map(Number)
    const end = new Date(y, m - 1, d, 23, 59, 59)
    parts.push(`UNTIL=${toICalUtc(end)}`)
  }

  return [`RRULE:${parts.join(';')}`]
}

function toICalUtc(d: Date): string {
  return `${d.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`
}

/** Lee un RRULE de Google y lo convierte al formato del formulario. */
export function parseRecurrence(recurrence?: string[] | null): RecurrenceSpec {
  const rule = recurrence?.find((r) => r.startsWith('RRULE:'))
  if (!rule) return NO_RECURRENCE

  const kv = new Map<string, string>()
  for (const pair of rule.slice(6).split(';')) {
    const [k, v] = pair.split('=')
    if (k && v) kv.set(k.toUpperCase(), v)
  }

  const interval = Number(kv.get('INTERVAL') ?? '1')
  const byDay = (kv.get('BYDAY') ?? '')
    .split(',')
    .map((code) => ICAL_DAYS.indexOf(code.replace(/^[+-]?\d+/, '') as (typeof ICAL_DAYS)[number]))
    .filter((i) => i >= 0)

  let freq: Freq
  switch (kv.get('FREQ')) {
    case 'DAILY':
      freq = 'daily'
      break
    case 'WEEKLY':
      freq = interval === 2 ? 'biweekly' : 'weekly'
      break
    case 'MONTHLY':
      freq = 'monthly'
      break
    case 'YEARLY':
      freq = 'yearly'
      break
    default:
      return NO_RECURRENCE
  }

  const untilRaw = kv.get('UNTIL')
  const until = untilRaw
    ? `${untilRaw.slice(0, 4)}-${untilRaw.slice(4, 6)}-${untilRaw.slice(6, 8)}`
    : undefined

  return { freq, byDay, until }
}

/** Etiqueta corta para mostrar en la ficha del evento. */
export function describeRecurrence(spec: RecurrenceSpec): string {
  if (spec.freq === 'none') return FREQ_LABELS.none

  let text = FREQ_LABELS[spec.freq]
  if ((spec.freq === 'weekly' || spec.freq === 'biweekly') && spec.byDay.length) {
    const names = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
    const sorted = [...spec.byDay].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    text += ` · ${sorted.map((d) => names[d]).join(', ')}`
  }
  if (spec.until) text += ` · hasta ${spec.until.split('-').reverse().join('/')}`
  return text
}
