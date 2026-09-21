import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { RELATIONSHIP_START } from './config'

/** Toda la app usa semana europea: lunes primero. */
const WEEK_OPTS = { weekStartsOn: 1 as const, locale: es }

export function weekStart(d: Date): Date {
  return startOfWeek(d, WEEK_OPTS)
}

export function weekEnd(d: Date): Date {
  return endOfWeek(d, WEEK_OPTS)
}

/** Las 6 semanas completas que cubren un mes, para la rejilla de la vista mes. */
export function monthGridRange(d: Date): { from: Date; to: Date } {
  return { from: weekStart(startOfMonth(d)), to: weekEnd(endOfMonth(d)) }
}

export function daysBetween(from: Date, to: Date): Date[] {
  const out: Date[] = []
  let cur = startOfDay(from)
  const last = startOfDay(to)
  while (cur <= last) {
    out.push(cur)
    cur = addDays(cur, 1)
  }
  return out
}

export const fmt = {
  time: (d: Date) => format(d, 'HH:mm'),
  dayNum: (d: Date) => format(d, 'd'),
  // 'EEEEE' da M para martes y miercoles. En Espana se usa X para miercoles.
  weekdayShort: (d: Date) => ['D', 'L', 'M', 'X', 'J', 'V', 'S'][d.getDay()],
  weekdayLong: (d: Date) => format(d, 'EEEE', { locale: es }),
  monthYear: (d: Date) => format(d, 'LLLL yyyy', { locale: es }),
  dayFull: (d: Date) => format(d, "EEEE d 'de' LLLL", { locale: es }),
  dayShort: (d: Date) => format(d, "d 'de' LLL", { locale: es }),
  /** Formato de input datetime-local, en hora local. */
  inputDateTime: (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm"),
  inputDate: (d: Date) => format(d, 'yyyy-MM-dd'),
}

/** Dias juntos, contando hoy como dia vivido. */
export function daysTogether(today = new Date()): number {
  return differenceInCalendarDays(startOfDay(today), startOfDay(RELATIONSHIP_START)) + 1
}

/** Desglose bonito para la tarjeta del contador. */
export function togetherBreakdown(today = new Date()): {
  days: number
  years: number
  months: number
  restDays: number
  nextMonthlyIn: number
} {
  const days = daysTogether(today)
  const start = startOfDay(RELATIONSHIP_START)
  const now = startOfDay(today)

  let years = now.getFullYear() - start.getFullYear()
  let months = now.getMonth() - start.getMonth()
  let restDays = now.getDate() - start.getDate()

  if (restDays < 0) {
    months -= 1
    // Dias del mes anterior al actual, para cerrar el resto correctamente.
    const prev = new Date(now.getFullYear(), now.getMonth(), 0).getDate()
    restDays += prev
  }
  if (months < 0) {
    years -= 1
    months += 12
  }

  // Cuantos dias faltan para el proximo aniversario mensual (dia 22).
  const day = start.getDate()
  let next = new Date(now.getFullYear(), now.getMonth(), day)
  if (next < now) next = new Date(now.getFullYear(), now.getMonth() + 1, day)

  return {
    days,
    years,
    months,
    restDays,
    nextMonthlyIn: differenceInCalendarDays(next, now),
  }
}
