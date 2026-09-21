import type { GCalCalendar } from './gcal'

/**
 * ¿Ese ID de calendario tiene pinta de ser el principal de una persona? Los de
 * Google acaban en `calendar.google.com` (grupos, festivos, cumpleaños); el de
 * una persona es un correo normal, y en Google el ID del calendario principal
 * de una cuenta ES su correo.
 */
export function isPersonalEmailId(id: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(id) && !id.includes('calendar.google.com')
}

/**
 * El correo de la pareja, si ya te ha compartido su calendario: es el ID de un
 * calendario de tu lista que no es tuyo, no es de Google y tiene forma de
 * correo. Asi el segundo en configurarlo no tiene que escribir nada, que es
 * justo el que llega perdido.
 */
export function detectPartnerEmail(
  list: GCalCalendar[],
  myEmail?: string,
): string | null {
  const mine = myEmail?.toLowerCase()
  const found = list.find(
    (c) =>
      !c.primary &&
      isPersonalEmailId(c.id) &&
      c.id.toLowerCase() !== mine &&
      c.accessRole !== 'owner',
  )
  return found?.id ?? null
}

/**
 * Candidatos a calendario conjunto: los que no son el principal de nadie y se
 * pueden editar. Se descartan los que parecen calendario de persona, porque si
 * la pareja te compartio el suyo con permiso de edicion apareceria aqui y no
 * es el conjunto.
 */
export function ourCalendarCandidates(list: GCalCalendar[]): GCalCalendar[] {
  return list.filter(
    (c) =>
      !c.primary &&
      !isPersonalEmailId(c.id) &&
      (c.accessRole === 'owner' || c.accessRole === 'writer'),
  )
}

/** Nombres con los que la gente llama al calendario de la pareja. */
const COUPLE_NAME = /\b(nosotros|nosotras|los\s+dos|las\s+dos|pareja|juntos|juntas)\b/i

/**
 * De entre los candidatos, cual es probablemente el calendario conjunto.
 * Devuelve null si no esta claro: preseleccionar mal es peor que no
 * preseleccionar, porque el usuario da por bueno lo que ya viene puesto.
 *
 * El orden de las pistas no es casual:
 *  1. Si te lo ha compartido otra persona, es casi seguro el conjunto: los
 *     tuyos sueltos los tienes tu.
 *  2. Si no, por el nombre, que descarta restos de configuraciones viejas
 *     ("Mi agenda") sin tener que saber de donde salieron.
 */
export function pickOurCalendar(list: GCalCalendar[]): GCalCalendar | null {
  const candidates = ourCalendarCandidates(list)
  if (candidates.length <= 1) return candidates[0] ?? null

  const shared = candidates.filter((c) => c.accessRole !== 'owner')
  if (shared.length === 1) return shared[0]

  const pool = shared.length > 1 ? shared : candidates
  const named = pool.filter((c) => COUPLE_NAME.test(c.summary ?? ''))
  return named.length === 1 ? named[0] : null
}
