/**
 * Constructor de RRULE (RFC 5545). Google se encarga de expandir la regla, asi
 * que aqui solo hay que generar la cadena correcta y saber leerla de vuelta
 * para rellenar el formulario al editar.
 */

export type Freq = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

/** Indices de getDay() de JS (0 = domingo) a codigos iCal. */
const ICAL_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const

export interface RecurrenceSpec {
  freq: Freq
  /** Cada cuantos dias/semanas/meses/años. 1 = todos. */
  interval: number
  /** Solo para weekly. Indices de getDay(): 0 = domingo. */
  byDay: number[]
  /** Fecha (sin hora) en la que deja de repetirse. */
  until?: string
  /** Numero total de repeticiones. Excluyente con `until`. */
  count?: number
}

export const NO_RECURRENCE: RecurrenceSpec = { freq: 'none', interval: 1, byDay: [] }

/** Nombre de la unidad, en singular y plural, para los textos. */
const UNITS: Record<Exclude<Freq, 'none'>, [string, string]> = {
  daily: ['día', 'días'],
  weekly: ['semana', 'semanas'],
  monthly: ['mes', 'meses'],
  yearly: ['año', 'años'],
}

export const FREQ_UNIT_LABELS: Record<Exclude<Freq, 'none'>, string> = {
  daily: 'días',
  weekly: 'semanas',
  monthly: 'meses',
  yearly: 'años',
}

/** Atajos de la interfaz. `custom` abre los controles finos. */
export type PresetId = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'custom'

export const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'none', label: 'No se repite' },
  { id: 'daily', label: 'Cada día' },
  { id: 'weekly', label: 'Cada semana' },
  { id: 'biweekly', label: 'Semana sí, semana no' },
  { id: 'monthly', label: 'Cada mes' },
  { id: 'yearly', label: 'Cada año' },
  { id: 'custom', label: 'Personalizado…' },
]

/** Qué atajo representa una regla, para marcar el botón correcto al editar. */
export function presetOf(spec: RecurrenceSpec): PresetId {
  if (spec.freq === 'none') return 'none'
  const plain = !spec.until && !spec.count && spec.byDay.length === 0
  if (!plain) return 'custom'
  if (spec.interval === 1 && spec.freq !== 'weekly') return spec.freq
  if (spec.freq === 'weekly' && spec.interval === 1) return 'weekly'
  if (spec.freq === 'weekly' && spec.interval === 2) return 'biweekly'
  return 'custom'
}

export function specOfPreset(id: PresetId, current: RecurrenceSpec): RecurrenceSpec {
  switch (id) {
    case 'none':
      return NO_RECURRENCE
    case 'biweekly':
      return { freq: 'weekly', interval: 2, byDay: [] }
    case 'custom':
      // Se parte de lo que ya hubiera, para no perder lo elegido.
      return current.freq === 'none' ? { freq: 'weekly', interval: 1, byDay: [] } : current
    default:
      return { freq: id, interval: 1, byDay: [] }
  }
}

/**
 * Devuelve el array `recurrence` que espera la API de Google, o undefined si el
 * evento no se repite.
 */
export function buildRecurrence(spec: RecurrenceSpec, start: Date): string[] | undefined {
  if (spec.freq === 'none') return undefined

  const parts: string[] = [`FREQ=${spec.freq.toUpperCase()}`]

  const interval = Math.max(1, Math.round(spec.interval || 1))
  if (interval > 1) parts.push(`INTERVAL=${interval}`)

  if (spec.freq === 'weekly') {
    // Si no se marca ningun dia, se repite el dia de la semana del evento.
    const days = spec.byDay.length ? spec.byDay : [start.getDay()]
    parts.push(`BYDAY=${days.map((d) => ICAL_DAYS[d]).join(',')}`)
  }

  // UNTIL y COUNT son excluyentes en RRULE. Gana COUNT si están los dos.
  if (spec.count && spec.count > 0) {
    parts.push(`COUNT=${Math.round(spec.count)}`)
  } else if (spec.until) {
    // UNTIL debe ir en UTC. Se toma el final del dia elegido en hora local para
    // que la ultima repeticion caiga dentro y no se pierda por el desfase.
    const [y, m, d] = spec.until.split('-').map(Number)
    parts.push(`UNTIL=${toICalUtc(new Date(y, m - 1, d, 23, 59, 59))}`)
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

  const freqRaw = kv.get('FREQ')
  const freq = (['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const).includes(
    freqRaw as 'DAILY',
  )
    ? (freqRaw!.toLowerCase() as Exclude<Freq, 'none'>)
    : null
  if (!freq) return NO_RECURRENCE

  const byDay = (kv.get('BYDAY') ?? '')
    .split(',')
    .map((code) =>
      ICAL_DAYS.indexOf(code.replace(/^[+-]?\d+/, '') as (typeof ICAL_DAYS)[number]),
    )
    .filter((i) => i >= 0)

  const untilRaw = kv.get('UNTIL')
  const countRaw = kv.get('COUNT')

  return {
    freq,
    interval: Math.max(1, Number(kv.get('INTERVAL') ?? '1') || 1),
    byDay,
    until: untilRaw
      ? `${untilRaw.slice(0, 4)}-${untilRaw.slice(4, 6)}-${untilRaw.slice(6, 8)}`
      : undefined,
    count: countRaw ? Number(countRaw) || undefined : undefined,
  }
}

const DAY_NAMES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

/** Texto en español de una regla, para la ficha del evento. */
export function describeRecurrence(spec: RecurrenceSpec): string {
  if (spec.freq === 'none') return 'No se repite'

  const [one, many] = UNITS[spec.freq]
  const n = Math.max(1, Math.round(spec.interval || 1))

  // "Cada semana" se lee mejor que "Cada 1 semana".
  let text = n === 1 ? `Cada ${one}` : `Cada ${n} ${many}`
  if (spec.freq === 'weekly' && n === 2) text = 'Semana sí, semana no'

  if (spec.freq === 'weekly' && spec.byDay.length) {
    // Ordenados empezando en lunes.
    const sorted = [...spec.byDay].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    text += ` · ${sorted.map((d) => DAY_NAMES[d]).join(', ')}`
  }

  if (spec.count) text += ` · ${spec.count} ${spec.count === 1 ? 'vez' : 'veces'}`
  else if (spec.until) text += ` · hasta ${spec.until.split('-').reverse().join('/')}`

  return text
}
