/** Fecha en la que empezamos. Alimenta el contador de dias juntos. */
export const RELATIONSHIP_START = new Date(2022, 10, 22) // 22/11/2022

/** Dia del mes del aniversario mensual, derivado de la fecha de inicio. */
export const ANNIVERSARY_DAY = RELATIONSHIP_START.getDate()

/**
 * Como se llaman los aniversarios en Google. La cuenta de meses y años NO va
 * aqui: la pone la app al pintarlos, porque un evento que se repite tiene un
 * unico nombre para todas sus repeticiones. Ver `elapsedLabel` en dates.ts.
 */
export const ANNIVERSARY_TITLE = '🐣❤️'

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
  /** Clase del chip del evento (definida en index.css). */
  chip: string
  /** Punto de color que identifica a la persona. */
  dot: string
  /** Barra vertical de color, al filo del evento. */
  bar: string
  text: string
}

/**
 * Clases de color de cada carril. Los valores estan en index.css, con una
 * version por tema y por juego de color.
 *
 * Aqui no hay nombres: `mine` y `hers` son carriles fijos, no "el mio" y "el
 * suyo" segun quien mire, asi que el nombre que se ensena depende de quien ha
 * entrado. Ver src/lib/owners.ts.
 */
export const OWNER_STYLES: Record<Owner, OwnerStyle> = {
  mine: { chip: 'chip-mine', dot: 'dot-mine', bar: 'bar-mine', text: 'fg-mine' },
  hers: { chip: 'chip-hers', dot: 'dot-hers', bar: 'bar-hers', text: 'fg-hers' },
  ours: { chip: 'chip-ours', dot: 'dot-ours', bar: 'bar-ours', text: 'fg-ours' },
}

/** Ventana del dia que se considera "tiempo util" al buscar huecos libres. */
export const DAY_WINDOW = { startHour: 8, endHour: 23 }
