import { ANNIVERSARY_DAY, RELATIONSHIP_START } from './config'
import { createEvent, deleteEvent, listEvents, patchEvent } from './gcal'
import { buildDescription } from './tags'

/**
 * Los aniversarios en el calendario conjunto: dos eventos que se repiten
 * solos, uno cada mes y otro cada año.
 *
 * Van sin numeros a proposito. Para que el nombre dijera "3 años y 10 meses"
 * habria que crear un evento por fecha —una serie tiene un unico titulo para
 * todas sus repeticiones—, y eso son sesenta eventos sueltos que hay que ir
 * alargando cada pocos años. Dos eventos recurrentes que no caducan nunca
 * salen mucho mas baratos.
 */

export const TITLE = '🐣❤️'

/** Cuantas peticiones a Google a la vez, al limpiar. */
const CONCURRENCY = 4

/**
 * El mensual salta el mes del aniversario anual. Si no, ese dia caerian los
 * dos. Con FREQ=MONTHLY, BYMONTH actua como filtro: se listan los once meses
 * que si valen.
 */
const MONTHLY_RRULE = (() => {
  const skip = RELATIONSHIP_START.getMonth() + 1 // 1-12
  const months = Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => m !== skip)
  return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${ANNIVERSARY_DAY};BYMONTH=${months.join(',')}`
})()

const YEARLY_RRULE = 'RRULE:FREQ=YEARLY'

/** Titulos que han usado versiones anteriores de la app. */
const LEGACY_TITLES = new Set([
  'Aniversario mensual ❤️',
  'Aniversario ❤️',
  'Aniversario mensual',
  'Aniversario',
  '💗 Un mes más juntos',
  '💗 Nuestro aniversario',
])

export interface AnniversaryResult {
  created: string[]
  updated: string[]
  /** Restos de versiones anteriores que se han quitado. */
  removed: number
}

export interface Progress {
  done: number
  total: number
}

export async function ensureAnniversaries(calendarId: string): Promise<AnniversaryResult> {
  const ours = await findOurs(calendarId)
  const result: AnniversaryResult = { created: [], updated: [], removed: 0 }

  // Los buenos son los dos recurrentes con el titulo actual. Cualquier otra
  // cosa es de una version anterior y sobra.
  const monthly = ours.find((e) => e.summary?.trim() === TITLE && ruleOf(e)?.includes('FREQ=MONTHLY'))
  const yearly = ours.find((e) => e.summary?.trim() === TITLE && ruleOf(e)?.includes('FREQ=YEARLY'))

  const keep = new Set([monthly?.id, yearly?.id].filter(Boolean) as string[])
  for (const e of ours) {
    if (!keep.has(e.id)) {
      await deleteEvent(calendarId, e.id)
      result.removed++
    }
  }

  // --- mensual ---
  if (!monthly) {
    await createEvent(calendarId, buildEvent(nextMonthly(), MONTHLY_RRULE, false))
    result.created.push('el mensual')
  } else if (ruleOf(monthly) !== MONTHLY_RRULE) {
    // Estaba creado con la regla vieja, que duplicaba en el mes del anual.
    await patchEvent(calendarId, monthly.id, { recurrence: [MONTHLY_RRULE] })
    result.updated.push('el mensual')
  }

  // --- anual ---
  if (!yearly) {
    await createEvent(calendarId, buildEvent(nextYearly(), YEARLY_RRULE, true))
    result.created.push('el anual')
  }

  return result
}

function buildEvent(start: Date, rrule: string, yearly: boolean) {
  return {
    summary: TITLE,
    description: buildDescription(`Desde el ${formatEs(RELATIONSHIP_START)}.`, ['aniversario']),
    start: { date: isoDate(start) },
    end: { date: isoDate(addDays(start, 1)) },
    recurrence: [rrule],
    reminders: {
      useDefault: false,
      overrides: yearly
        ? [
            { method: 'popup' as const, minutes: 7 * 24 * 60 },
            { method: 'popup' as const, minutes: 24 * 60 },
          ]
        : [{ method: 'popup' as const, minutes: 12 * 60 }],
    },
  }
}

/* ---------- limpieza ---------- */

/** ¿Este evento lo puso la app como aniversario? */
function isAppAnniversary(summary?: string): boolean {
  const title = summary?.trim() ?? ''
  // Por el titulo y no por la etiqueta: la etiqueta `#aniversario` la puede
  // haber puesto el usuario en un evento suyo, y ese no hay que tocarlo.
  // `startsWith` recoge tambien los que llevaban la cuenta ("🐣❤️ 4 años").
  return title === TITLE || title.startsWith(`${TITLE} `) || LEGACY_TITLES.has(title)
}

/**
 * Todo lo que la app haya puesto como aniversario, sin expandir las series:
 * asi de una serie llega su evento maestro, que es el que hay que tocar.
 */
async function findOurs(calendarId: string) {
  const to = new Date()
  to.setFullYear(to.getFullYear() + 10)
  const events = await listEvents(calendarId, new Date(RELATIONSHIP_START), to, {
    expandSeries: false,
  })
  return events.filter((e) => isAppAnniversary(e.summary))
}

/** Cuantos hay, para decirlo antes de borrarlos. */
export async function countAnniversaries(calendarId: string): Promise<number> {
  return (await findOurs(calendarId)).length
}

/** Borra todos los que haya puesto la app, de esta version y de las anteriores. */
export async function removeAllAnniversaries(
  calendarId: string,
  onProgress?: (p: Progress) => void,
): Promise<number> {
  const ours = await findOurs(calendarId)

  let done = 0
  onProgress?.({ done, total: ours.length })

  for (let i = 0; i < ours.length; i += CONCURRENCY) {
    await Promise.all(
      ours.slice(i, i + CONCURRENCY).map(async (e) => {
        await deleteEvent(calendarId, e.id)
        onProgress?.({ done: ++done, total: ours.length })
      }),
    )
  }

  return ours.length
}

/* ---------- fechas ---------- */

function ruleOf(e: { recurrence?: string[] | null }): string | undefined {
  return e.recurrence?.find((r) => r.startsWith('RRULE:'))
}

/** Proximo dia del aniversario mensual, hoy incluido, saltando el mes del anual. */
function nextMonthly(): Date {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const skip = RELATIONSHIP_START.getMonth()

  for (let i = 0; i < 13; i++) {
    const candidate = new Date(now.getFullYear(), now.getMonth() + i, ANNIVERSARY_DAY)
    if (candidate >= today && candidate.getMonth() !== skip) return candidate
  }
  return today
}

/** Proximo aniversario anual, hoy incluido. */
function nextYearly(): Date {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const month = RELATIONSHIP_START.getMonth()
  const day = RELATIONSHIP_START.getDate()
  const thisYear = new Date(now.getFullYear(), month, day)
  return thisYear >= today ? thisYear : new Date(now.getFullYear() + 1, month, day)
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatEs(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}
