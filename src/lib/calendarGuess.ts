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
 * Marca que la app escribe en la descripcion del calendario conjunto que crea.
 * Es lo que permite que los dos moviles den con EL MISMO calendario sin que
 * nadie tenga que elegirlo en un desplegable: el nombre se puede cambiar, la
 * marca no.
 */
export const SHARED_MARKER = '[calendario-pareja]'

export const SHARED_DESCRIPTION = `Calendario de los dos. ${SHARED_MARKER}`

/** ¿Lleva la marca que pone la app al crear el calendario conjunto? */
export function hasSharedMarker(c: GCalCalendar): boolean {
  return Boolean(c.description?.includes(SHARED_MARKER))
}

/** ¿Este calendario puede ser el conjunto? */
export function looksShared(c: GCalCalendar): boolean {
  if (c.primary || isPersonalEmailId(c.id)) return false
  if (hasSharedMarker(c)) return true
  return COUPLE_NAME.test(c.summary ?? '')
}

/**
 * El calendario conjunto. No se elige: se deduce, y siempre da el mismo
 * resultado con la misma lista, para que los dos moviles acaben en el mismo.
 *
 * El orden de las pistas:
 *  1. La marca que pone la app, que es la unica señal fiable.
 *  2. Que te lo haya compartido otra persona: los tuyos sueltos los tienes tu,
 *     asi que uno compartido es casi seguro el de los dos.
 *  3. El nombre, para los creados antes de que existiera la marca.
 *
 * A igualdad de pistas se ordena por ID, que no cambia, para que la respuesta
 * no dependa del orden en que Google devuelva la lista.
 */
export function pickOurCalendar(
  list: GCalCalendar[],
  eventCounts?: Record<string, number>,
): GCalCalendar | null {
  const candidates = list.filter(looksShared)
  if (candidates.length <= 1) return candidates[0] ?? null

  /*
   * Se comparan las pistas por orden, no se suman: una pista mejor gana
   * siempre, por mucho que la otra tenga muchos eventos.
   */
  const rank = (c: GCalCalendar) => [
    hasSharedMarker(c) ? 1 : 0,
    c.accessRole !== 'owner' ? 1 : 0,
    // Con dos calendarios "Nosotros" de versiones anteriores, el bueno es el
    // que tiene cosas apuntadas. Sin esto se elegiria casi al azar y podrias
    // acabar mirando el vacio, pensando que has perdido los eventos.
    eventCounts?.[c.id] ?? 0,
  ]

  return [...candidates].sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    for (let i = 0; i < ra.length; i++) {
      if (ra[i] !== rb[i]) return rb[i] - ra[i]
    }
    // Ultimo desempate: el ID, que no cambia, para que los dos moviles elijan
    // el mismo aunque Google devuelva la lista en otro orden.
    return a.id.localeCompare(b.id)
  })[0]
}

/**
 * Los conjuntos que sobran: todo lo que parece el calendario de los dos y no
 * es el que se esta usando. Son los duplicados a limpiar.
 */
export function duplicateSharedCalendars(
  list: GCalCalendar[],
  keepId?: string,
): GCalCalendar[] {
  return list.filter((c) => looksShared(c) && c.id !== keepId && c.accessRole === 'owner')
}
