import { isToday, isTomorrow } from 'date-fns'
import { daysBetween, fmt } from '../lib/dates'
import { byStart, occursOn, type AppEvent } from '../lib/model'
import EventChip from './EventChip'

interface Props {
  from: Date
  to: Date
  events: AppEvent[]
  onOpenEvent: (ev: AppEvent) => void
}

/** Lista continua por dias, saltandose los dias vacios. */
export default function AgendaView({ from, to, events, onOpenEvent }: Props) {
  const days = daysBetween(from, to)
    .map((day) => ({ day, list: events.filter((e) => occursOn(e, day)).sort(byStart) }))
    .filter(({ list }) => list.length > 0)

  if (!days.length) {
    return (
      <div className="flex flex-1 items-center justify-center px-8 text-center">
        <p className="text-sm text-subtle">No hay eventos en este periodo.</p>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
      {days.map(({ day, list }) => (
        <section key={day.toISOString()} className="pt-3.5">
          <h3 className="sticky top-0 z-10 -mx-3 mb-2 flex items-center gap-2 bg-bg/95 px-3 py-1.5 backdrop-blur">
            {/* Numerito del dia: ancla la lista sin necesitar separadores. */}
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold tabular-nums ${
                isToday(day) ? 'bg-accent text-accent-fg' : 'bg-elevated text-muted'
              }`}
            >
              {fmt.dayNum(day)}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-extrabold first-letter:uppercase">
              {isToday(day) ? 'Hoy' : isTomorrow(day) ? 'Mañana' : fmt.dayFull(day)}
            </span>
            <span className="shrink-0 text-[10px] font-bold text-subtle">
              {list.length} {list.length === 1 ? 'evento' : 'eventos'}
            </span>
          </h3>
          <div className="flex flex-col gap-2">
            {list.map((ev) => (
              <EventChip
                key={`${ev.calendarId}:${ev.id}`}
                event={ev}
                onClick={onOpenEvent}
                variant="full"
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
