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
        <p className="text-sm text-white/40">No hay eventos en este periodo.</p>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
      {days.map(({ day, list }) => (
        <section key={day.toISOString()} className="pt-3">
          <h3 className="sticky top-0 z-10 -mx-3 mb-1.5 bg-[#0d1b24]/95 px-3 py-1 text-xs font-semibold backdrop-blur">
            <span
              className={
                isToday(day) ? 'text-sky-200' : 'text-white/60 first-letter:uppercase'
              }
            >
              {isToday(day) ? 'Hoy' : isTomorrow(day) ? 'Mañana' : fmt.dayFull(day)}
            </span>
          </h3>
          <div className="flex flex-col gap-1.5">
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
