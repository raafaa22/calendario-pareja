import { isToday, isTomorrow } from 'date-fns'
import { DAY_WINDOW } from '../lib/config'
import { daysBetween, fmt } from '../lib/dates'
import { formatDuration, freeSlotsForDay } from '../lib/freeSlots'
import { occursOn, type AppEvent } from '../lib/model'

interface Props {
  from: Date
  to: Date
  /** Eventos ya filtrados: solo los carriles visibles cuentan como ocupado. */
  events: AppEvent[]
  minMinutes: number
  onMinMinutesChange: (m: number) => void
  /** Crear un evento conjunto directamente en el hueco elegido. */
  onPickSlot: (start: Date, end: Date) => void
}

const PRESETS = [30, 60, 90, 120, 180]

/**
 * Cruza los calendarios visibles y muestra los ratos en que nadie tiene nada.
 * Tocar un hueco abre el formulario con esas horas ya puestas.
 */
export default function FreeSlotsView({
  from,
  to,
  events,
  minMinutes,
  onMinMinutesChange,
  onPickSlot,
}: Props) {
  const days = daysBetween(from, to)
    .map((day) => ({
      day,
      slots: freeSlotsForDay(day, events.filter((e) => occursOn(e, day)), minMinutes),
    }))
    .filter(({ slots }) => slots.length > 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-line px-3 pb-2">
        <p className="mb-2 text-xs text-subtle">
          Huecos en los que <span className="text-fg">nadie</span> tiene nada, entre las{' '}
          {DAY_WINDOW.startHour}:00 y las {DAY_WINDOW.endHour}:00.
        </p>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="shrink-0 text-[11px] text-subtle">Al menos</span>
          {PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onMinMinutesChange(m)}
              className={`tap shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition ${
                minMinutes === m
                  ? 'border-accent-line bg-accent-soft text-accent'
                  : 'border-line text-muted'
              }`}
            >
              {formatDuration(m)}
            </button>
          ))}
        </div>
      </div>

      {days.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-8 text-center">
          <p className="text-sm text-subtle">
            No hay ningún hueco de {formatDuration(minMinutes)} seguidos. Prueba con
            menos tiempo.
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {days.map(({ day, slots }) => (
            <section key={day.toISOString()} className="pt-3">
              <h3 className="mb-1.5 text-xs font-semibold">
                <span
                  className={
                    isToday(day) ? 'text-accent' : 'text-muted first-letter:uppercase'
                  }
                >
                  {isToday(day) ? 'Hoy' : isTomorrow(day) ? 'Mañana' : fmt.dayFull(day)}
                </span>
              </h3>
              <div className="flex flex-col gap-1.5">
                {slots.map((slot) => (
                  <button
                    key={slot.start.toISOString()}
                    type="button"
                    onClick={() => onPickSlot(slot.start, slot.end)}
                    className="tap flex items-center justify-between rounded-xl border border-accent-line bg-accent-soft px-3 py-2.5 text-left"
                  >
                    <span className="text-sm font-medium tabular-nums text-accent">
                      {fmt.time(slot.start)} – {fmt.time(slot.end)}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted">
                        {formatDuration(slot.minutes)}
                      </span>
                      <span className="text-accent">＋</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
