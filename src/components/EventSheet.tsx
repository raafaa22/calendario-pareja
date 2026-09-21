import { useEffect, useMemo, useState } from 'react'
import { OWNERS, OWNER_STYLES, type Owner } from '../lib/config'
import { fmt } from '../lib/dates'
import {
  deleteEventFor,
  saveExistingEvent,
  saveNewEvent,
  type EditScope,
  type EventDraft,
} from '../lib/eventWrite'
import { useOwnerLabels } from '../lib/labels'
import type { AppEvent } from '../lib/model'
import {
  FREQ_UNIT_LABELS,
  NO_RECURRENCE,
  PRESETS,
  describeRecurrence,
  presetOf,
  specOfPreset,
  type Freq,
  type PresetId,
} from '../lib/recurrence'
import type { Settings } from '../lib/storage'
import { EMOJI_SUGGESTIONS, TAGS } from '../lib/tags'

/** Avisos disponibles, en minutos antes del evento. */
const REMINDER_PRESETS = [
  { minutes: 0, label: 'A la hora' },
  { minutes: 10, label: '10 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 h' },
  { minutes: 120, label: '2 h' },
  { minutes: 1440, label: '1 día' },
]

/** Lunes primero, con los indices de getDay() de JS. */
const WEEKDAYS = [
  { day: 1, label: 'L' },
  { day: 2, label: 'M' },
  { day: 3, label: 'X' },
  { day: 4, label: 'J' },
  { day: 5, label: 'V' },
  { day: 6, label: 'S' },
  { day: 0, label: 'D' },
]

const UNITS: Exclude<Freq, 'none'>[] = ['daily', 'weekly', 'monthly', 'yearly']

export interface SheetSeed {
  start: Date
  end: Date
  owner?: Owner
  tags?: string[]
  title?: string
}

interface Props {
  settings: Settings
  /** Evento a editar, o null para crear uno nuevo. */
  event: AppEvent | null
  /** Valores iniciales cuando se crea desde un dia o un hueco libre. */
  seed?: SheetSeed
  onClose: () => void
  onSaved: () => void
}

export default function EventSheet({ settings, event, seed, onClose, onSaved }: Props) {
  const isNew = !event
  const labels = useOwnerLabels()
  const [draft, setDraft] = useState<EventDraft>(() => initialDraft(event, seed, settings))
  const [scope, setScope] = useState<EditScope>('instance')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [preset, setPreset] = useState<PresetId>(() =>
    presetOf(initialDraft(event, seed, settings).recurrence),
  )

  const isSeries = Boolean(event?.seriesId) || (event?.recurrence.freq ?? 'none') !== 'none'
  const readOnly = Boolean(event && !event.editable)

  const targetCalendarId = settings.calendars[draft.owner]?.id ?? ''
  const availableOwners = useMemo(
    () => OWNERS.filter((o) => settings.calendars[o]?.editable),
    [settings.calendars],
  )

  // Emoji que se ve ahora mismo: el elegido, o el de la etiqueta como pista.
  const shownEmoji =
    draft.emoji ||
    (draft.tags.length ? (TAGS.find((t) => t.id === draft.tags[0])?.icon ?? '') : '')

  // Cerrar con Escape, como en cualquier modal de escritorio.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const setRec = (patch: Partial<EventDraft['recurrence']>) =>
    setDraft((d) => ({ ...d, recurrence: { ...d.recurrence, ...patch } }))

  /** Al mover el inicio, el fin se arrastra manteniendo la duracion. */
  const setStart = (value: Date) =>
    setDraft((d) => {
      const delta = d.end.getTime() - d.start.getTime()
      return { ...d, start: value, end: new Date(value.getTime() + Math.max(delta, 0)) }
    })

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value]

  function choosePreset(id: PresetId) {
    setPreset(id)
    set('recurrence', specOfPreset(id, draft.recurrence))
  }

  async function handleSave() {
    if (!targetCalendarId) {
      setError('Ese calendario no está configurado.')
      return
    }
    if (draft.end <= draft.start && !draft.allDay) {
      setError('La hora de fin tiene que ser posterior a la de inicio.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      if (isNew) await saveNewEvent(targetCalendarId, draft)
      else await saveExistingEvent(event!, draft, isSeries ? scope : 'instance', targetCalendarId)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar')
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!event) return
    setBusy(true)
    setError(null)
    try {
      await deleteEventFor(event, isSeries ? scope : 'instance')
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido borrar')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <div
        className="relative flex max-h-[93vh] w-full max-w-lg flex-col rounded-t-[28px] border border-line bg-surface shadow-float sm:rounded-[28px]"
        style={{ paddingBottom: 'var(--safe-bottom)' }}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="tap text-sm text-muted"
            disabled={busy}
          >
            Cancelar
          </button>
          <h2 className="truncate text-sm font-extrabold">
            {isNew ? 'Nuevo evento' : readOnly ? 'Evento' : 'Editar evento'}
          </h2>
          {readOnly ? (
            <span className="text-sm text-subtle">Solo lectura</span>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="tap rounded-full bg-accent px-4 py-1.5 text-sm font-bold text-accent-fg disabled:opacity-50"
            >
              {busy ? '…' : 'Guardar'}
            </button>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <fieldset disabled={readOnly || busy} className="flex flex-col gap-4">
            {/* Emoji + titulo en la misma linea: el emoji es lo primero que se
                ve del evento en todas las vistas, asi que se elige aqui. */}
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => setShowEmoji((v) => !v)}
                className={`tap flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl border text-xl transition ${
                  showEmoji ? 'border-accent-line bg-accent-soft' : 'border-line bg-elevated'
                }`}
                aria-label="Elegir emoji"
              >
                {shownEmoji || <span className="text-sm text-subtle">☺</span>}
              </button>
              <input
                value={draft.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="¿Qué es?"
                autoFocus={isNew}
                className="min-w-0 flex-1 rounded-2xl border border-line bg-elevated px-3.5 text-base font-semibold outline-none placeholder:font-normal placeholder:text-subtle focus:border-accent-line"
              />
            </div>

            {showEmoji && (
              <div className="rounded-2xl border border-line bg-elevated p-3">
                <div className="mb-2 flex items-center gap-2">
                  <input
                    value={draft.emoji}
                    onChange={(e) => set('emoji', e.target.value.slice(0, 8))}
                    placeholder="O pega el que quieras"
                    className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-subtle focus:border-accent-line"
                  />
                  {draft.emoji && (
                    <button
                      type="button"
                      onClick={() => set('emoji', '')}
                      className="tap shrink-0 rounded-xl border border-line px-3 py-2 text-xs text-muted"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                <div className="grid max-h-36 grid-cols-10 gap-1 overflow-y-auto">
                  {EMOJI_SUGGESTIONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        set('emoji', e)
                        setShowEmoji(false)
                      }}
                      className={`tap flex aspect-square items-center justify-center rounded-lg text-base transition ${
                        draft.emoji === e ? 'bg-accent-soft ring-2 ring-accent' : 'hover:bg-surface'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                {!draft.emoji && draft.tags.length > 0 && (
                  <p className="mt-2 text-[11px] leading-snug text-subtle">
                    Sin elegir ninguno se usa el de la etiqueta.
                  </p>
                )}
              </div>
            )}

            <Field label="¿De quién es?">
              <div className="grid grid-cols-3 gap-2">
                {OWNERS.map((owner) => {
                  const style = OWNER_STYLES[owner]
                  const usable = availableOwners.includes(owner)
                  const active = draft.owner === owner
                  return (
                    <button
                      key={owner}
                      type="button"
                      onClick={() => set('owner', owner)}
                      disabled={!usable}
                      className={`tap truncate rounded-2xl border px-2 py-2.5 text-xs font-bold transition ${
                        active ? style.chip : 'border-line text-subtle'
                      } disabled:opacity-25`}
                    >
                      <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${style.dot}`} />
                      {labels[owner]}
                    </button>
                  )
                })}
              </div>
            </Field>

            <label className="flex items-center justify-between rounded-2xl border border-line bg-elevated px-3.5 py-3">
              <span className="text-sm font-semibold">Todo el día</span>
              <input
                type="checkbox"
                checked={draft.allDay}
                onChange={(e) => set('allDay', e.target.checked)}
                className="h-5 w-5 accent-accent"
              />
            </label>

            {/* En una columna: a 375px el selector nativo de fecha y hora no
                cabe a media pantalla y se corta. */}
            <div className="flex flex-col gap-2">
              <LabelledRow label="Empieza">
                <DateTimeInput value={draft.start} allDay={draft.allDay} onChange={setStart} />
              </LabelledRow>
              <LabelledRow label="Termina">
                <DateTimeInput
                  value={draft.end}
                  allDay={draft.allDay}
                  onChange={(v) => set('end', v)}
                />
              </LabelledRow>
            </div>

            <Field label="Se repite">
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => choosePreset(p.id)}
                    className={`tap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      preset === p.id
                        ? 'border-accent-line bg-accent-soft text-accent'
                        : 'border-line text-subtle'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {preset === 'custom' && (
                <div className="mt-2.5 flex flex-col gap-2.5 rounded-2xl border border-line bg-elevated p-3">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-xs font-semibold text-muted">Cada</span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      inputMode="numeric"
                      value={draft.recurrence.interval}
                      onChange={(e) =>
                        setRec({ interval: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })
                      }
                      className="w-16 rounded-xl border border-line bg-surface px-2.5 py-2 text-center text-sm font-bold tabular-nums outline-none focus:border-accent-line"
                    />
                    <select
                      value={draft.recurrence.freq === 'none' ? 'weekly' : draft.recurrence.freq}
                      onChange={(e) => setRec({ freq: e.target.value as Freq })}
                      className="min-w-0 flex-1 appearance-none rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold outline-none focus:border-accent-line"
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {FREQ_UNIT_LABELS[u]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {draft.recurrence.freq === 'weekly' && (
                    <div>
                      <div className="mb-1.5 text-xs font-semibold text-muted">Qué días</div>
                      <div className="flex gap-1">
                        {WEEKDAYS.map(({ day, label }) => {
                          const active = draft.recurrence.byDay.includes(day)
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => setRec({ byDay: toggle(draft.recurrence.byDay, day) })}
                              className={`tap h-9 flex-1 rounded-xl border text-xs font-bold transition ${
                                active
                                  ? 'border-accent bg-accent text-accent-fg'
                                  : 'border-line text-subtle'
                              }`}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="mb-1.5 text-xs font-semibold text-muted">Termina</div>
                    <div className="flex gap-1.5">
                      {(
                        [
                          ['never', 'Nunca'],
                          ['until', 'En fecha'],
                          ['count', 'Tras N veces'],
                        ] as const
                      ).map(([kind, label]) => {
                        const current = draft.recurrence.count
                          ? 'count'
                          : draft.recurrence.until
                            ? 'until'
                            : 'never'
                        return (
                          <button
                            key={kind}
                            type="button"
                            onClick={() =>
                              // until y count son excluyentes en RRULE.
                              setRec({
                                until: kind === 'until' ? fmt.inputDate(defaultUntil(draft.start)) : undefined,
                                count: kind === 'count' ? 10 : undefined,
                              })
                            }
                            className={`tap flex-1 rounded-xl border py-2 text-[11px] font-semibold transition ${
                              current === kind
                                ? 'border-accent bg-accent text-accent-fg'
                                : 'border-line text-subtle'
                            }`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>

                    {draft.recurrence.until && (
                      <input
                        type="date"
                        value={draft.recurrence.until}
                        onChange={(e) => setRec({ until: e.target.value || undefined })}
                        className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm tabular-nums outline-none focus:border-accent-line"
                      />
                    )}
                    {draft.recurrence.count !== undefined && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={999}
                          inputMode="numeric"
                          value={draft.recurrence.count}
                          onChange={(e) =>
                            setRec({
                              count: Math.max(1, Math.min(999, Number(e.target.value) || 1)),
                            })
                          }
                          className="w-20 rounded-xl border border-line bg-surface px-2.5 py-2 text-center text-sm font-bold tabular-nums outline-none focus:border-accent-line"
                        />
                        <span className="text-xs text-muted">veces en total</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {draft.recurrence.freq !== 'none' && (
                <p className="mt-2 text-[11px] font-semibold text-accent">
                  {describeRecurrence(draft.recurrence)}
                </p>
              )}
            </Field>

            <Field label="Avisos">
              <div className="flex flex-wrap gap-1.5">
                {REMINDER_PRESETS.map(({ minutes, label }) => {
                  const active = draft.reminders.includes(minutes)
                  return (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() =>
                        set('reminders', toggle(draft.reminders, minutes).sort((a, b) => a - b))
                      }
                      className={`tap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? 'border-accent-line bg-accent-soft text-accent'
                          : 'border-line text-subtle'
                      }`}
                    >
                      {active ? '🔔 ' : ''}
                      {label}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-subtle">
                Los avisos llegan como notificación de Google Calendar al móvil.
              </p>
            </Field>

            <Field label="Etiquetas">
              <div className="flex flex-wrap gap-1.5">
                {TAGS.map((tag) => {
                  const active = draft.tags.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => set('tags', toggle(draft.tags, tag.id))}
                      className={`tap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? 'border-accent-line bg-accent-soft text-accent'
                          : 'border-line text-subtle'
                      }`}
                    >
                      <span className="mr-1">{tag.icon}</span>
                      {tag.label}
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field label="Lugar">
              <input
                value={draft.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="Opcional"
                className="w-full rounded-2xl border border-line bg-elevated px-3.5 py-2.5 text-sm outline-none placeholder:text-subtle focus:border-accent-line"
              />
            </Field>

            <Field label="Notas">
              <textarea
                value={draft.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={3}
                placeholder="Opcional"
                className="w-full resize-none rounded-2xl border border-line bg-elevated px-3.5 py-2.5 text-sm outline-none placeholder:text-subtle focus:border-accent-line"
              />
            </Field>

            {isSeries && !isNew && (
              <Field label="Los cambios afectan a">
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['instance', 'Solo este día'],
                      ['series', 'Toda la serie'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setScope(value)}
                      className={`tap rounded-2xl border px-2 py-2.5 text-xs font-bold transition ${
                        scope === value
                          ? 'border-accent-line bg-accent-soft text-accent'
                          : 'border-line text-subtle'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Field>
            )}
          </fieldset>

          {error && (
            <p className="mt-4 rounded-2xl border border-danger-line bg-danger-soft px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          {event && (
            <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4">
              {event.htmlLink && (
                <a
                  href={event.htmlLink}
                  target="_blank"
                  rel="noreferrer"
                  className="tap text-center text-xs text-subtle underline decoration-line"
                >
                  Abrir en Google Calendar
                </a>
              )}
              {!readOnly &&
                (confirmDelete ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="tap flex-1 rounded-2xl border border-line py-2.5 text-sm font-semibold text-muted"
                    >
                      No, dejarlo
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={busy}
                      className="tap flex-1 rounded-2xl bg-danger-strong py-2.5 text-sm font-bold text-danger-strong-fg disabled:opacity-50"
                    >
                      Borrar {isSeries && scope === 'series' ? 'la serie' : 'este día'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="tap rounded-2xl border border-danger-line py-2.5 text-sm font-semibold text-danger"
                  >
                    Borrar evento
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-subtle">{label}</div>
      {children}
    </div>
  )
}

/** Etiqueta a la izquierda y control a la derecha, en la misma linea. */
function LabelledRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs font-bold text-subtle">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/**
 * Usa los selectores nativos de fecha y hora del sistema, que en iPhone y
 * Android son mucho mejores que cualquier calendario propio.
 */
function DateTimeInput({
  value,
  allDay,
  onChange,
}: {
  value: Date
  allDay: boolean
  onChange: (d: Date) => void
}) {
  return (
    <input
      type={allDay ? 'date' : 'datetime-local'}
      value={allDay ? fmt.inputDate(value) : fmt.inputDateTime(value)}
      onChange={(e) => {
        if (!e.target.value) return
        // El valor del input viene en hora local: new Date() lo interpreta bien
        // para datetime-local, pero 'yyyy-MM-dd' se leeria como UTC.
        const next = allDay ? new Date(`${e.target.value}T00:00:00`) : new Date(e.target.value)
        if (!Number.isNaN(next.getTime())) onChange(next)
      }}
      className="w-full rounded-2xl border border-line bg-elevated px-3 py-2.5 text-sm font-semibold tabular-nums outline-none focus:border-accent-line"
    />
  )
}

/** Un año por delante: es una fecha de fin razonable por defecto. */
function defaultUntil(start: Date): Date {
  const out = new Date(start)
  out.setFullYear(out.getFullYear() + 1)
  return out
}

function initialDraft(
  event: AppEvent | null,
  seed: SheetSeed | undefined,
  settings: Settings,
): EventDraft {
  if (event) {
    return {
      title: event.title === '(sin título)' ? '' : event.title,
      owner: event.owner,
      allDay: event.allDay,
      start: event.start,
      end: event.end,
      notes: event.notes,
      tags: event.tags,
      emoji: event.emoji ?? '',
      location: event.location ?? '',
      reminders: event.reminders,
      recurrence: event.recurrence,
    }
  }

  const start = seed?.start ?? nextHalfHour()
  const end = seed?.end ?? new Date(start.getTime() + 60 * 60_000)
  // Por defecto el primer carril editable, empezando por "Nosotros" si se puede.
  const owner =
    seed?.owner ??
    (['ours', 'mine', 'hers'] as Owner[]).find((o) => settings.calendars[o]?.editable) ??
    'ours'

  return {
    title: seed?.title ?? '',
    owner,
    allDay: false,
    start,
    end,
    notes: '',
    tags: seed?.tags ?? [],
    emoji: '',
    location: '',
    reminders: settings.defaultReminders,
    recurrence: NO_RECURRENCE,
  }
}

function nextHalfHour(): Date {
  const d = new Date()
  d.setMinutes(d.getMinutes() > 30 ? 60 : 30, 0, 0)
  return d
}
