import { ANNIVERSARY_DAY, RELATIONSHIP_START } from './config'
import { createEvent, listEvents } from './gcal'
import { daysTogether } from './dates'
import { buildDescription } from './tags'

/**
 * Crea los dos eventos recurrentes de aniversario en el calendario conjunto:
 * el mensual (cada dia 22) y el anual (cada 22 de noviembre).
 *
 * Son eventos de dia completo con aviso el dia antes, para que Google avise a
 * los dos moviles. Se comprueba antes si ya existen para no duplicarlos si se
 * pulsa el boton dos veces.
 */

const MONTHLY_TITLE = 'Aniversario mensual'
const YEARLY_TITLE = 'Aniversario'

export interface AnniversaryResult {
  created: string[]
  skipped: string[]
}

export async function ensureAnniversaries(calendarId: string): Promise<AnniversaryResult> {
  const existing = await findExisting(calendarId)
  const created: string[] = []
  const skipped: string[] = []

  // Primer dia 22 desde hoy, para que la serie no arranque en el pasado y
  // llene el calendario de avisos vencidos.
  const monthlyStart = nextOccurrence(ANNIVERSARY_DAY)

  if (existing.has(MONTHLY_TITLE)) {
    skipped.push('el aniversario mensual')
  } else {
    await createEvent(calendarId, {
      summary: MONTHLY_TITLE,
      description: buildDescription(
        `Desde el ${formatEs(RELATIONSHIP_START)}.`,
        ['aniversario'],
      ),
      start: { date: isoDate(monthlyStart) },
      end: { date: isoDate(addDays(monthlyStart, 1)) },
      recurrence: [`RRULE:FREQ=MONTHLY;BYMONTHDAY=${ANNIVERSARY_DAY}`],
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 12 * 60 }] },
    })
    created.push('el aniversario mensual')
  }

  const yearlyStart = nextYearly()

  if (existing.has(YEARLY_TITLE)) {
    skipped.push('el aniversario anual')
  } else {
    await createEvent(calendarId, {
      summary: YEARLY_TITLE,
      description: buildDescription(
        `Juntos desde el ${formatEs(RELATIONSHIP_START)}: ${daysTogether(yearlyStart)} días.`,
        ['aniversario'],
      ),
      start: { date: isoDate(yearlyStart) },
      end: { date: isoDate(addDays(yearlyStart, 1)) },
      recurrence: ['RRULE:FREQ=YEARLY'],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 7 * 24 * 60 },
          { method: 'popup', minutes: 24 * 60 },
        ],
      },
    })
    created.push('el aniversario anual')
  }

  return { created, skipped }
}

/** Busca los titulos en el proximo año para saber si ya estan puestos. */
async function findExisting(calendarId: string): Promise<Set<string>> {
  const from = new Date()
  const to = new Date()
  to.setFullYear(to.getFullYear() + 1)

  const events = await listEvents(calendarId, from, to)
  return new Set(events.map((e) => e.summary?.trim()).filter((s): s is string => Boolean(s)))
}

/** Proximo dia `day` del mes, hoy incluido. */
function nextOccurrence(day: number): Date {
  const now = new Date()
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), day)
  if (thisMonth >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) return thisMonth
  return new Date(now.getFullYear(), now.getMonth() + 1, day)
}

/** Proximo aniversario anual, hoy incluido. */
function nextYearly(): Date {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const thisYear = new Date(
    now.getFullYear(),
    RELATIONSHIP_START.getMonth(),
    RELATIONSHIP_START.getDate(),
  )
  if (thisYear >= today) return thisYear
  return new Date(now.getFullYear() + 1, RELATIONSHIP_START.getMonth(), RELATIONSHIP_START.getDate())
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
