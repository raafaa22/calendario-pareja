import { OWNER_STYLES } from '../lib/config'
import { fmt } from '../lib/dates'
import { useOwnerLabels } from '../lib/labels'
import type { AppEvent } from '../lib/model'
import { getTag } from '../lib/tags'

/**
 * Emoji del evento: manda el elegido a mano, y si no hay, el de la primera
 * etiqueta reconocida.
 */
export function eventIcon(ev: AppEvent): string | null {
  if (ev.emoji) return ev.emoji
  for (const id of ev.tags) {
    const tag = getTag(id)
    if (tag) return tag.icon
  }
  return null
}

/** Que se ensena en el chip compacto, ademas del nombre. */
export interface CompactParts {
  time: boolean
  emoji: boolean
}

const DEFAULT_PARTS: CompactParts = { time: true, emoji: false }

interface Props {
  event: AppEvent
  onClick: (ev: AppEvent) => void
  /** `compact` va dentro de las celdas del mes; `full` en listas. */
  variant?: 'compact' | 'full'
  /** Solo para `compact`. */
  parts?: CompactParts
}

export default function EventChip({
  event,
  onClick,
  variant = 'compact',
  parts = DEFAULT_PARTS,
}: Props) {
  const style = OWNER_STYLES[event.owner]
  const labels = useOwnerLabels()
  const icon = eventIcon(event)

  // Celda del mes: unos 42px utiles, o sea unos 10 caracteres. Que se ensena
  // ademas del nombre lo decide el usuario en los ajustes, porque la hora y el
  // emoji gastan 2-3 caracteres cada uno y el nombre es lo que se recorta.
  if (variant === 'compact') {
    const showTime = parts.time && !event.allDay
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClick(event)
        }}
        title={`${event.allDay ? 'Todo el día' : fmt.time(event.start)} · ${event.displayTitle}`}
        className={`tap w-full truncate rounded-[5px] border px-[2px] py-[1px] text-left text-[8px] leading-[1.5] tracking-[-0.02em] ${style.chip}`}
      >
        {parts.emoji && icon && <span className="mr-[1px]">{icon}</span>}
        {showTime && (
          <span className="font-extrabold tabular-nums">{fmt.timeCompact(event.start)} </span>
        )}
        <span className="font-semibold">{event.displayTitle}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      className="tap group flex w-full items-stretch gap-3 rounded-2xl border border-line bg-surface p-2.5 text-left shadow-card transition active:scale-[0.99]"
    >
      <span className={style.bar} />

      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${style.chip}`}
      >
        {icon ?? '•'}
      </span>

      <span className="min-w-0 flex-1 self-center">
        <span className="block truncate text-[15px] font-bold leading-tight">
          {event.displayTitle}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span className="font-semibold tabular-nums">
            {event.allDay ? 'Todo el día' : `${fmt.time(event.start)} – ${fmt.time(event.end)}`}
          </span>
          <span className={`inline-flex items-center gap-1 ${style.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
            {labels[event.owner]}
          </span>
          {event.location && <span className="truncate">📍 {event.location}</span>}
        </span>
      </span>

      {event.reminders.length > 0 && (
        <span className="self-center text-[11px] text-subtle">🔔</span>
      )}
    </button>
  )
}
