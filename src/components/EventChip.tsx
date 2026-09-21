import { OWNER_STYLES } from '../lib/config'
import { fmt } from '../lib/dates'
import type { AppEvent } from '../lib/model'
import { getTag } from '../lib/tags'

/** Icono de la primera etiqueta reconocida, que es la que define el evento. */
export function eventIcon(ev: AppEvent): string | null {
  for (const id of ev.tags) {
    const tag = getTag(id)
    if (tag) return tag.icon
  }
  return null
}

interface Props {
  event: AppEvent
  onClick: (ev: AppEvent) => void
  /** Compacto para las celdas del mes; completo para listas. */
  variant?: 'compact' | 'full'
}

export default function EventChip({ event, onClick, variant = 'compact' }: Props) {
  const style = OWNER_STYLES[event.owner]
  const icon = eventIcon(event)

  // En las celdas del mes no caben ni tres letras de titulo, asi que el evento
  // se reduce a su icono sobre el color de quien es. La lista completa del dia
  // esta justo debajo de la rejilla, a un toque.
  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClick(event)
        }}
        title={event.title}
        aria-label={event.title}
        className={`tap flex h-[17px] w-[17px] items-center justify-center rounded border text-[10px] leading-none ${style.chip}`}
      >
        {icon ?? <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      className={`tap flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left ${style.chip}`}
    >
      <span className="mt-px shrink-0 text-lg leading-none">{icon ?? '•'}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{event.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs opacity-75">
          <span className="tabular-nums">
            {event.allDay ? 'Todo el día' : `${fmt.time(event.start)} – ${fmt.time(event.end)}`}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
            {style.label}
          </span>
          {event.location && <span className="truncate">📍 {event.location}</span>}
        </span>
      </span>
      {event.reminders.length > 0 && <span className="shrink-0 text-xs opacity-60">🔔</span>}
    </button>
  )
}
