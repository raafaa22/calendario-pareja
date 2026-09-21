import { isSameDay, isSameMonth, isToday } from 'date-fns'
import { daysBetween, fmt, monthGridRange } from '../lib/dates'
import { byStart, occursOn, type AppEvent } from '../lib/model'
import EventChip from './EventChip'

/** Iconos que caben en una celda antes de resumir con "+N". */
const MAX_ICONS = 6

interface Props {
  cursor: Date
  events: AppEvent[]
  selected: Date
  onSelectDay: (d: Date) => void
  onOpenEvent: (ev: AppEvent) => void
}

export default function MonthView({ cursor, events, selected, onSelectDay, onOpenEvent }: Props) {
  const { from, to } = monthGridRange(cursor)
  const days = daysBetween(from, to)
  const dayOfSelected = events.filter((e) => occursOn(e, selected)).sort(byStart)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-7 border-b border-white/10 px-1 pb-1">
        {days.slice(0, 7).map((d) => (
          <div key={d.toISOString()} className="text-center text-[10px] font-semibold text-white/40">
            {fmt.weekdayShort(d)}
          </div>
        ))}
      </div>

      <div className="grid flex-1 auto-rows-fr grid-cols-7 gap-px overflow-y-auto px-1 py-1">
        {days.map((day) => {
          const dayEvents = events.filter((e) => occursOn(e, day)).sort(byStart)
          const shown = dayEvents.slice(0, MAX_ICONS)
          const hidden = dayEvents.length - shown.length
          const outside = !isSameMonth(day, cursor)
          const isSel = isSameDay(day, selected)

          return (
            <div
              key={day.toISOString()}
              role="button"
              tabIndex={0}
              onClick={() => onSelectDay(day)}
              onKeyDown={(e) => e.key === 'Enter' && onSelectDay(day)}
              className={`tap flex min-h-[64px] cursor-pointer flex-col gap-0.5 rounded-lg p-1 transition ${
                isSel ? 'bg-white/10 ring-1 ring-white/30' : 'hover:bg-white/5'
              } ${outside ? 'opacity-35' : ''}`}
            >
              <span
                className={`self-start rounded px-1 text-[11px] font-semibold tabular-nums ${
                  isToday(day) ? 'bg-slate-100 text-slate-900' : 'text-white/70'
                }`}
              >
                {fmt.dayNum(day)}
              </span>

              <div className="flex flex-wrap content-start gap-0.5">
                {shown.map((ev) => (
                  <EventChip key={`${ev.calendarId}:${ev.id}`} event={ev} onClick={onOpenEvent} />
                ))}
                {hidden > 0 && (
                  <span className="self-center text-[9px] leading-none text-white/45">
                    +{hidden}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Detalle del dia tocado, debajo de la rejilla. */}
      <div className="flex max-h-[38%] shrink-0 flex-col border-t border-white/10">
        <div className="shrink-0 px-3 pt-2 text-xs font-semibold text-white/60 first-letter:uppercase">
          {fmt.dayFull(selected)}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {dayOfSelected.length === 0 ? (
            <p className="py-1 text-sm text-white/35">Sin eventos.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
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
