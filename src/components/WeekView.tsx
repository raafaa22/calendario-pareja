import { useEffect, useMemo, useRef } from 'react'
import { isToday } from 'date-fns'
import { DAY_WINDOW, OWNER_STYLES } from '../lib/config'
import { daysBetween, fmt, weekEnd, weekStart } from '../lib/dates'
import { occursOn, type AppEvent } from '../lib/model'
import { eventIcon } from './EventChip'

/** Altura en pixeles de una hora en la rejilla. */
const HOUR_PX = 48

interface Props {
  cursor: Date
  events: AppEvent[]
  onOpenEvent: (ev: AppEvent) => void
  onSelectDay: (d: Date) => void
}

export default function WeekView({ cursor, events, onOpenEvent, onSelectDay }: Props) {
  const days = useMemo(() => daysBetween(weekStart(cursor), weekEnd(cursor)), [cursor])
  const scroller = useRef<HTMLDivElement>(null)

  // Arranca mostrando la franja util, no las 00:00.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = (DAY_WINDOW.startHour - 1) * HOUR_PX
  }, [])

  const hours = Array.from({ length: 24 }, (_, i) => i)
  const allDay = days.map((d) => events.filter((e) => e.allDay && occursOn(e, d)))
  const hasAllDay = allDay.some((list) => list.length > 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Cabecera de dias, fija */}
      <div className="flex shrink-0 border-b border-line pr-1">
        <div className="w-9 shrink-0" />
        {days.map((d) => (
          <button
            key={d.toISOString()}
            type="button"
            onClick={() => onSelectDay(d)}
            className="tap flex flex-1 flex-col items-center py-1"
          >
            <span className="text-[9px] font-semibold text-subtle">{fmt.weekdayShort(d)}</span>
            <span
              className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                isToday(d) ? 'bg-accent text-accent-fg' : 'text-fg'
              }`}
            >
              {fmt.dayNum(d)}
            </span>
          </button>
        ))}
      </div>

      {/* Banda de eventos de dia completo, solo si hay alguno esta semana */}
      {hasAllDay && (
        <div className="flex shrink-0 border-b border-line pr-1">
          <div className="w-9 shrink-0 pt-1 text-right text-[8px] text-subtle">día</div>
          {days.map((d, i) => (
            <div key={d.toISOString()} className="flex min-w-0 flex-1 flex-col gap-px p-px">
              {allDay[i].map((ev) => (
                <button
                  key={`${ev.calendarId}:${ev.id}`}
                  type="button"
                  onClick={() => onOpenEvent(ev)}
                  className={`tap truncate rounded border px-1 text-[9px] leading-tight ${OWNER_STYLES[ev.owner].chip}`}
                >
                  {ev.title}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Rejilla de horas */}
      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="relative flex" style={{ height: 24 * HOUR_PX }}>
          {/* Columna de horas */}
          <div className="w-9 shrink-0">
            {hours.map((h) => (
              <div
                key={h}
                className="relative border-t border-line text-right"
                style={{ height: HOUR_PX }}
              >
                <span className="absolute -top-1.5 right-1 text-[9px] tabular-nums text-subtle">
                  {h > 0 ? `${String(h).padStart(2, '0')}` : ''}
                </span>
              </div>
            ))}
          </div>

          {days.map((day) => (
            <DayColumn
              key={day.toISOString()}
              day={day}
              events={events.filter((e) => !e.allDay && occursOn(e, day))}
              onOpenEvent={onOpenEvent}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function DayColumn({
  day,
  events,
  onOpenEvent,
}: {
  day: Date
  events: AppEvent[]
  onOpenEvent: (ev: AppEvent) => void
}) {
  const placed = useMemo(() => layout(events, day), [events, day])

  return (
    <div className="relative min-w-0 flex-1 border-l border-line">
      {Array.from({ length: 24 }, (_, h) => (
        <div key={h} className="border-t border-line" style={{ height: HOUR_PX }} />
      ))}

      {isToday(day) && <NowLine />}

      {placed.map(({ ev, top, height, left, width, narrow }) => {
        const icon = eventIcon(ev)
        return (
          <button
            key={`${ev.calendarId}:${ev.id}`}
            type="button"
            onClick={() => onOpenEvent(ev)}
            title={`${fmt.time(ev.start)} ${ev.title}`}
            aria-label={`${fmt.time(ev.start)} ${ev.title}`}
            className={`tap absolute overflow-hidden rounded border text-[9px] leading-tight ${
              narrow ? 'flex items-start justify-center pt-0.5' : 'px-0.5 text-left'
            } ${OWNER_STYLES[ev.owner].chip}`}
            style={{ top, height, left: `${left}%`, width: `${width}%` }}
          >
            {narrow ? (
              <span className="text-[11px] leading-none">{icon ?? '•'}</span>
            ) : (
              <>
                <span className="block truncate font-medium">
                  {icon && <span className="mr-px">{icon}</span>}
                  {ev.title}
                </span>
                {height > 26 && (
                  <span className="block truncate tabular-nums opacity-70">
                    {fmt.time(ev.start)}
                  </span>
                )}
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Linea roja de "ahora", que se mueve cada minuto. */
function NowLine() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const place = () => {
      const now = new Date()
      const y = (now.getHours() + now.getMinutes() / 60) * HOUR_PX
      if (ref.current) ref.current.style.top = `${y}px`
    }
    place()
    const timer = setInterval(place, 60_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div ref={ref} className="pointer-events-none absolute inset-x-0 z-10 h-px bg-accent">
      <span className="absolute -left-0.5 -top-1 h-2 w-2 rounded-full bg-accent" />
    </div>
  )
}

/**
 * Reparte el ancho de la columna entre eventos que se solapan, para que dos
 * cosas a la misma hora se vean las dos.
 */
function layout(events: AppEvent[], day: Date) {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
  const dayEnd = dayStart + 24 * 3600_000

  const items = events
    .map((ev) => {
      const start = Math.max(ev.start.getTime(), dayStart)
      const end = Math.min(ev.end.getTime(), dayEnd)
      return { ev, start, end }
    })
    .sort((a, b) => a.start - b.start || b.end - a.end)

  // Agrupa en "racimos" de eventos que se pisan entre si.
  const clusters: (typeof items)[] = []
  let current: typeof items = []
  let clusterEnd = -Infinity

  for (const item of items) {
    if (item.start >= clusterEnd && current.length) {
      clusters.push(current)
      current = []
    }
    current.push(item)
    clusterEnd = Math.max(clusterEnd, item.end)
  }
  if (current.length) clusters.push(current)

  const out: {
    ev: AppEvent
    top: number
    height: number
    left: number
    width: number
    narrow: boolean
  }[] = []

  for (const cluster of clusters) {
    // Columnas dentro del racimo: cada evento va a la primera libre.
    const columns: number[] = []
    const assigned = cluster.map((item) => {
      let col = columns.findIndex((end) => end <= item.start)
      if (col === -1) {
        col = columns.length
        columns.push(item.end)
      } else {
        columns[col] = item.end
      }
      return { ...item, col }
    })

    const total = columns.length
    for (const item of assigned) {
      const topMin = (item.start - dayStart) / 60_000
      const durMin = Math.max((item.end - item.start) / 60_000, 20) // minimo legible
      out.push({
        ev: item.ev,
        top: (topMin / 60) * HOUR_PX,
        height: (durMin / 60) * HOUR_PX - 1,
        left: (item.col / total) * 100,
        width: (1 / total) * 100,
        // Con la columna partida en dos o mas no cabe ni una palabra: solo icono.
        narrow: total > 1,
      })
    }
  }

  return out
}
