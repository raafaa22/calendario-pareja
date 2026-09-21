/** Fecha en la que empezamos. Alimenta el contador de dias juntos. */
export const RELATIONSHIP_START = new Date(2022, 10, 22) // 22/11/2022

/** Dia del mes del aniversario mensual, derivado de la fecha de inicio. */
export const ANNIVERSARY_DAY = RELATIONSHIP_START.getDate()

/** Permiso minimo necesario: leer y escribir eventos en los calendarios. */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ')

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

/** Los tres calendarios de la app. El orden importa: es el de los filtros. */
export const OWNERS = ['mine', 'hers', 'ours'] as const
export type Owner = (typeof OWNERS)[number]

export interface OwnerStyle {
  label: string
  /** Clases de Tailwind para el chip del evento. */
  chip: string
  /** Punto de color que identifica a la persona. */
  dot: string
  text: string
}

/**
 * Azul para uno, verde para el otro, y la mezcla de los dos para lo conjunto.
 * Todos en tonos pastel sobre fondo oscuro.
 */
export const OWNER_STYLES: Record<Owner, OwnerStyle> = {
  mine: {
    label: 'Yo',
    chip: 'bg-sky-400/15 text-sky-100 border-sky-300/35',
    dot: 'bg-sky-300',
    text: 'text-sky-200',
  },
  hers: {
    label: 'Ella',
    chip: 'bg-emerald-400/15 text-emerald-50 border-emerald-300/35',
    dot: 'bg-emerald-300',
    text: 'text-emerald-200',
  },
  ours: {
    label: 'Nosotros',
    chip: 'bg-gradient-to-br from-sky-400/25 to-emerald-400/25 text-teal-50 border-teal-200/70',
    dot: 'bg-gradient-to-br from-sky-300 to-emerald-300',
    text: 'text-teal-200',
  },
}

/** Ventana del dia que se considera "tiempo util" al buscar huecos libres. */
export const DAY_WINDOW = { startHour: 8, endHour: 23 }
