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
      <div className="shrink-0 px-3 pb-2.5">
        <p className="mb-2 text-xs leading-snug text-subtle">
          Ratos en los que <span className="font-bold text-fg">nadie</span> tiene nada, entre las{' '}
          {DAY_WINDOW.startHour}:00 y las {DAY_WINDOW.endHour}:00.
        </p>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="shrink-0 text-[11px] font-bold text-subtle">Al menos</span>
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
            <section key={day.toISOString()} className="pt-3.5">
              <h3 className="mb-2 flex items-center gap-2">
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
              </h3>
              <div className="flex flex-col gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.start.toISOString()}
                    type="button"
                    onClick={() => onPickSlot(slot.start, slot.end)}
                    className="tap flex items-center justify-between rounded-2xl border border-accent-line bg-accent-soft px-3.5 py-3 text-left shadow-card transition active:scale-[0.99]"
                  >
                    <span>
                      <span className="block text-[15px] font-extrabold tabular-nums text-accent">
                        {fmt.time(slot.start)} – {fmt.time(slot.end)}
                      </span>
                      <span className="text-[11px] font-semibold text-muted">
                        {formatDuration(slot.minutes)} libres
                      </span>
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-light text-accent-fg">
                      ＋
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
