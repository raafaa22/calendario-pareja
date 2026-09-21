import { ANNIVERSARY_DAY, RELATIONSHIP_START } from './config'
import { createEvent, listEvents, patchEvent } from './gcal'
import { daysTogether } from './dates'
import { buildDescription } from './tags'

/**
 * Crea los dos eventos recurrentes de aniversario en el calendario conjunto:
 * el mensual (cada dia 22) y el anual (cada 22 de noviembre).
 *
 * Son eventos de dia completo con aviso, para que Google notifique a los dos
 * moviles. Si ya existen no se duplican, y si el mensual quedo creado con la
 * regla antigua se corrige.
 */

const MONTHLY_TITLE = 'Aniversario mensual ❤️'
const YEARLY_TITLE = 'Aniversario ❤️'

/** Titulos anteriores, para reconocer eventos ya creados y no duplicarlos. */
const KNOWN_TITLES: Record<string, 'monthly' | 'yearly'> = {
  [MONTHLY_TITLE]: 'monthly',
  [YEARLY_TITLE]: 'yearly',
  'Aniversario mensual': 'monthly',
  Aniversario: 'yearly',
  '💗 Un mes más juntos': 'monthly',
  '💗 Nuestro aniversario': 'yearly',
}

/**
 * El mensual salta el mes del aniversario anual. Si no, el 22 de noviembre
 * caerian los dos eventos el mismo dia. Con FREQ=MONTHLY, BYMONTH actua como
 * filtro: se listan los once meses que si valen.
 */
const MONTHLY_RRULE = (() => {
  const skip = RELATIONSHIP_START.getMonth() + 1 // 1-12
  const months = Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => m !== skip)
  return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${ANNIVERSARY_DAY};BYMONTH=${months.join(',')}`
})()

const YEARLY_RRULE = 'RRULE:FREQ=YEARLY'

export interface AnniversaryResult {
  created: string[]
  updated: string[]
  skipped: string[]
}

export async function ensureAnniversaries(calendarId: string): Promise<AnniversaryResult> {
  const existing = await findExisting(calendarId)
  const result: AnniversaryResult = { created: [], updated: [], skipped: [] }

  // --- mensual ---
  const monthly = existing.get('monthly')
  if (monthly) {
    // Estaba creado con la regla vieja, que duplicaba en noviembre.
    if (monthly.rrule !== MONTHLY_RRULE || monthly.summary !== MONTHLY_TITLE) {
      await patchEvent(calendarId, monthly.id, {
        summary: MONTHLY_TITLE,
        recurrence: [MONTHLY_RRULE],
      })
      result.updated.push('el aniversario mensual')
    } else {
      result.skipped.push('el aniversario mensual')
    }
  } else {
    const start = nextMonthly()
    await createEvent(calendarId, {
      summary: MONTHLY_TITLE,
      description: buildDescription(`Desde el ${formatEs(RELATIONSHIP_START)}.`, ['aniversario']),
      start: { date: isoDate(start) },
      end: { date: isoDate(addDays(start, 1)) },
      recurrence: [MONTHLY_RRULE],
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 12 * 60 }] },
    })
    result.created.push('el aniversario mensual')
  }

  // --- anual ---
  const yearly = existing.get('yearly')
  if (yearly) {
    if (yearly.summary !== YEARLY_TITLE) {
      await patchEvent(calendarId, yearly.id, { summary: YEARLY_TITLE })
      result.updated.push('el aniversario anual')
    } else {
      result.skipped.push('el aniversario anual')
    }
  } else {
    const start = nextYearly()
    await createEvent(calendarId, {
      summary: YEARLY_TITLE,
      description: buildDescription(
        `Juntos desde el ${formatEs(RELATIONSHIP_START)}: ${daysTogether(start)} días.`,
        ['aniversario'],
      ),
      start: { date: isoDate(start) },
      end: { date: isoDate(addDays(start, 1)) },
      recurrence: [YEARLY_RRULE],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 7 * 24 * 60 },
          { method: 'popup', minutes: 24 * 60 },
        ],
      },
    })
    result.created.push('el aniversario anual')
  }

  return result
}

interface Found {
  id: string
  summary: string
  rrule?: string
}

/**
 * Busca en el proximo año los aniversarios ya creados. Se piden las series sin
 * expandir (`singleEvents` false) para quedarse con el evento maestro, que es
 * el que hay que corregir si su regla es la antigua.
 */
async function findExisting(calendarId: string): Promise<Map<'monthly' | 'yearly', Found>> {
  const from = new Date()
  const to = new Date()
  to.setFullYear(to.getFullYear() + 1)

  const events = await listEvents(calendarId, from, to, { expandSeries: false })
  const out = new Map<'monthly' | 'yearly', Found>()

  for (const e of events) {
    const kind = KNOWN_TITLES[e.summary?.trim() ?? '']
    if (!kind || out.has(kind)) continue
    out.set(kind, {
      id: e.id,
      summary: e.summary?.trim() ?? '',
      rrule: e.recurrence?.find((r) => r.startsWith('RRULE:')),
    })
  }

  return out
}

/** Proximo dia 22 del mes, hoy incluido, saltando el mes del anual. */
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
