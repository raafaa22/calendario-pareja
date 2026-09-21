/** Fecha en la que empezamos. Alimenta el contador de dias juntos. */
export const RELATIONSHIP_START = new Date(2022, 10, 22) // 22/11/2022

/** Dia del mes del aniversario mensual, derivado de la fecha de inicio. */
export const ANNIVERSARY_DAY = RELATIONSHIP_START.getDate()

/**
 * Permisos que pide la app:
 * - calendar / calendar.events: leer y escribir en los calendarios.
 * - userinfo.profile / .email: el nombre y la foto para personalizar la
 *   interfaz, y el correo para guardar los ajustes de cada uno por separado.
 *   Son permisos no sensibles.
 */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

/** Los tres calendarios de la app. El orden importa: es el de los filtros. */
export const OWNERS = ['mine', 'hers', 'ours'] as const
export type Owner = (typeof OWNERS)[number]

export interface OwnerStyle {
  label: string
  /** Clase del chip del evento (definida en index.css). */
  chip: string
  /** Punto de color que identifica a la persona. */
  dot: string
  text: string
}

/**
 * Azul para uno, verde para el otro y turquesa para lo conjunto. Los valores
 * de cada clase estan en index.css, con una version para tema claro y otra
 * para oscuro. No dependen del acento elegido: el color de cada persona es
 * identidad, y debe ser el mismo en los dos moviles.
 */
export const OWNER_STYLES: Record<Owner, OwnerStyle> = {
  mine: { label: 'Yo', chip: 'chip-mine', dot: 'dot-mine', text: 'fg-mine' },
  hers: { label: 'Ella', chip: 'chip-hers', dot: 'dot-hers', text: 'fg-hers' },
  ours: { label: 'Nosotros', chip: 'chip-ours', dot: 'dot-ours', text: 'fg-ours' },
}

/** Ventana del dia que se considera "tiempo util" al buscar huecos libres. */
export const DAY_WINDOW = { startHour: 8, endHour: 23 }
