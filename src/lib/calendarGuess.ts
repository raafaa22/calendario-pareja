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
