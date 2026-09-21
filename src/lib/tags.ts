/**
 * Las etiquetas viven al final de la descripcion del evento, en su propia
 * linea. Asi Google Calendar las guarda sin saber nada de ellas y la app las
 * lee para pintar el icono de cada evento. Se pueden editar tambien desde la app de
 * Google a mano, siguen funcionando.
 */

export interface TagDef {
  id: string
  label: string
  icon: string
}

export const TAGS: TagDef[] = [
  { id: 'clase', label: 'Clase', icon: '📚' },
  { id: 'practicas', label: 'Prácticas', icon: '🩺' },
  { id: 'trabajo', label: 'Trabajo', icon: '💼' },
  { id: 'gym', label: 'Gym', icon: '🏋️' },
  { id: 'medico', label: 'Médico', icon: '⚕️' },
  { id: 'fisio', label: 'Fisio', icon: '🦴' },
  { id: 'barbero', label: 'Barbero', icon: '💈' },
  { id: 'cena', label: 'Cena', icon: '🍽️' },
  { id: 'comida', label: 'Comida', icon: '🥗' },
  { id: 'cita', label: 'Cita', icon: '🎟️' },
  { id: 'viaje', label: 'Viaje', icon: '✈️' },
  { id: 'cumple', label: 'Cumpleaños', icon: '🎂' },
  { id: 'aniversario', label: 'Aniversario', icon: '❤️' },
  { id: 'familia', label: 'Familia', icon: '👨‍👩‍👧' },
  { id: 'amigos', label: 'Amigos', icon: '🍻' },
  { id: 'recado', label: 'Recado', icon: '📋' },
]

const TAG_BY_ID = new Map(TAGS.map((t) => [t.id, t]))

export function getTag(id: string): TagDef | undefined {
  return TAG_BY_ID.get(id)
}

/** Acepta acentos y guiones, para que #cumpleaños o #clase-inglés funcionen. */
const TAG_RE = /#([\p{L}\p{N}_-]+)/gu

/**
 * Emoji elegido a mano para el evento. Va marcado para poder separarlo de las
 * notas, igual que las etiquetas, y sobrevive a que alguien edite el evento
 * desde la app de Google.
 */
const EMOJI_RE = /\[emoji:([^\]]{1,16})\]/u

export interface ParsedDescription {
  notes: string
  tags: string[]
  /** Emoji elegido a mano, si lo hay. */
  emoji?: string
}

/**
 * Separa la descripcion en notas libres, etiquetas y emoji. Devuelve solo las
 * etiquetas conocidas para no ensuciar la interfaz con hashtags casuales que
 * alguien escriba dentro de una nota.
 */
export function parseDescription(description?: string | null): ParsedDescription {
  if (!description) return { notes: '', tags: [] }

  const emoji = description.match(EMOJI_RE)?.[1]?.trim() || undefined

  const found = new Set<string>()
  for (const match of description.matchAll(TAG_RE)) {
    const id = match[1].toLowerCase()
    if (TAG_BY_ID.has(id)) found.add(id)
  }

  // Quita el marcador de emoji y solo las etiquetas reconocidas, y limpia las
  // lineas que se quedan vacias al hacerlo.
  const notes = description
    .replace(EMOJI_RE, '')
    .replace(TAG_RE, (whole, id: string) =>
      TAG_BY_ID.has(id.toLowerCase()) ? '' : whole,
    )
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line, i, arr) => line !== '' || (i > 0 && i < arr.length - 1 && arr[i - 1] !== ''))
    .join('\n')
    .trim()

  return { notes, tags: [...found], emoji }
}

/** Reconstruye la descripcion a partir de notas, etiquetas y emoji. */
export function buildDescription(notes: string, tags: string[], emoji?: string): string {
  const clean = notes.trim()
  const marks = [...tags.map((t) => `#${t}`), emoji ? `[emoji:${emoji}]` : '']
    .filter(Boolean)
    .join(' ')
  if (!marks) return clean
  return clean ? `${clean}\n\n${marks}` : marks
}

/** Emojis que se ofrecen como atajo en el formulario. */
export const EMOJI_SUGGESTIONS = [
  '❤️', '🎉', '🎂', '🍕', '🍽️', '☕', '🍻', '🎬', '🎵', '🎮',
  '📚', '✏️', '💼', '💻', '🏋️', '🏃', '⚽', '🧘', '🩺', '⚕️',
  '💊', '🦷', '💈', '✈️', '🚗', '🏖️', '🏠', '🛒', '🐶', '🌙',
  '☀️', '⭐', '🔔', '📞', '🎁', '💸', '🧾', '🔧', '🌸', '🍀',
]
