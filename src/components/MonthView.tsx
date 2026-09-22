import { isSameDay, isSameMonth, isToday } from 'date-fns'
import { daysBetween, fmt, monthGridRange } from '../lib/dates'
import { byStart, occursOn, type AppEvent } from '../lib/model'
import EventChip, { type CompactParts } from './EventChip'

/**
 * Eventos con nombre que caben en una celda. A partir de ahi se resume con
 * "+N", que al tocar el dia se despliega entero abajo.
 */
const MAX_NAMED = 3

interface Props {
  cursor: Date
  events: AppEvent[]
  selected: Date
  onSelectDay: (d: Date) => void
  onOpenEvent: (ev: AppEvent) => void
  /** Que se ensena en cada evento de la rejilla, ademas del nombre. */
  chipParts: CompactParts
}

export default function MonthView({
  cursor,
  events,
  selected,
  onSelectDay,
  onOpenEvent,
  chipParts,
}: Props) {
  const { from, to } = monthGridRange(cursor)
  const days = daysBetween(from, to)
  const dayOfSelected = events.filter((e) => occursOn(e, selected)).sort(byStart)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid shrink-0 grid-cols-7 px-2 pb-1.5">
        {days.slice(0, 7).map((d) => (
          <div
            key={d.toISOString()}
            className="text-center text-[10px] font-extrabold tracking-wider text-subtle"
          >
            {fmt.weekdayShort(d)}
          </div>
        ))}
      </div>

      {/*
        Las filas tienen alto minimo y la rejilla hace scroll. Es lo que permite
        que quepan los nombres de los eventos sin apretar las celdas: si una
        semana esta cargada, crece y se baja con el dedo.
      */}
      <div className="grid min-h-0 flex-1 auto-rows-[minmax(66px,1fr)] grid-cols-7 gap-1 overflow-y-auto px-2 pb-2">
        {days.map((day) => {
          const dayEvents = events.filter((e) => occursOn(e, day)).sort(byStart)
          const shown = dayEvents.slice(0, MAX_NAMED)
          const hidden = dayEvents.length - shown.length
          const outside = !isSameMonth(day, cursor)
          const isSel = isSameDay(day, selected)
          const today = isToday(day)

          return (
            <div
              key={day.toISOString()}
              role="button"
              tabIndex={0}
              onClick={() => onSelectDay(day)}
              onKeyDown={(e) => e.key === 'Enter' && onSelectDay(day)}
              className={`tap flex cursor-pointer flex-col gap-[3px] rounded-xl p-1 transition ${
                isSel
                  ? 'bg-accent-soft ring-2 ring-accent-line'
                  : outside
                    ? 'bg-transparent'
                    : 'bg-sunken'
              } ${outside ? 'opacity-40' : ''}`}
            >
              <span
                className={`mx-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold tabular-nums ${
                  today ? 'bg-accent text-accent-fg' : 'text-muted'
                }`}
              >
                {fmt.dayNum(day)}
              </span>

              <div className="flex min-w-0 flex-col gap-[2px]">
                {shown.map((ev) => (
                  <EventChip
                    key={`${ev.calendarId}:${ev.id}`}
                    event={ev}
                    onClick={onOpenEvent}
                    parts={chipParts}
                  />
                ))}
                {hidden > 0 && (
                  <span className="pl-1 text-[8.5px] font-bold text-subtle">+{hidden} más</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Detalle del dia tocado. */}
      <div className="flex max-h-[32%] shrink-0 flex-col rounded-t-3xl border-t border-line bg-surface shadow-float">
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-3">
          <h2 className="truncate text-sm font-extrabold first-letter:uppercase">
            {fmt.dayFull(selected)}
          </h2>
          {dayOfSelected.length > 0 && (
            <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">
              {dayOfSelected.length}
            </span>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2.5">
          {dayOfSelected.length === 0 ? (
            <p className="text-sm text-subtle">Sin eventos.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {dayOfSelected.map((ev) => (
                <EventChip
                  key={`${ev.calendarId}:${ev.id}`}
                  event={ev}
                  onClick={onOpenEvent}
                  variant="full"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
