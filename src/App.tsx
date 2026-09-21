import { useCallback, useMemo, useState } from 'react'
import { addDays, addMonths, startOfDay } from 'date-fns'
import { OWNERS, OWNER_STYLES, type Owner } from './lib/config'
import { fmt, monthGridRange, weekEnd, weekStart } from './lib/dates'
import type { AppEvent } from './lib/model'
import { isConfigured } from './lib/storage'
import { useAuth } from './hooks/useAuth'
import { useEvents } from './hooks/useEvents'
import { useSettings } from './hooks/useSettings'
import AgendaView from './components/AgendaView'
import DaysCounter from './components/DaysCounter'
import EventSheet, { type SheetSeed } from './components/EventSheet'
import FreeSlotsView from './components/FreeSlotsView'
import Login from './components/Login'
import MonthView from './components/MonthView'
import SettingsView from './components/SettingsView'
import SetupCalendars from './components/SetupCalendars'
import WeekView from './components/WeekView'

type View = 'month' | 'week' | 'agenda' | 'free'

const VIEWS: { id: View; label: string; icon: string }[] = [
  { id: 'month', label: 'Mes', icon: '▦' },
  { id: 'week', label: 'Semana', icon: '▤' },
  { id: 'agenda', label: 'Agenda', icon: '☰' },
  { id: 'free', label: 'Huecos', icon: '✨' },
]

export default function App() {
  const { signedIn, checking, error: authError, login, logout } = useAuth()
  const { settings, update, ready } = useSettings()

  const [view, setView] = useState<View>('month')
  const [showSettings, setShowSettings] = useState(false)
  const [cursor, setCursor] = useState(() => startOfDay(new Date()))
  const [selected, setSelected] = useState(() => startOfDay(new Date()))
  const [sheet, setSheet] = useState<{ event: AppEvent | null; seed?: SheetSeed } | null>(null)

  // Rango a pedir a Google segun la vista. Se memoiza para que useEvents no
  // vuelva a cargar en cada render.
  const range = useMemo(() => {
    switch (view) {
      case 'month':
        return monthGridRange(cursor)
      case 'week':
        return { from: weekStart(cursor), to: weekEnd(cursor) }
      default:
        // Agenda y huecos miran hacia delante desde el dia visible.
        return { from: startOfDay(cursor), to: addDays(cursor, 42) }
    }
  }, [view, cursor])

  const { events, loading, error, offline, reload } = useEvents(
    settings,
    range.from,
    range.to,
    signedIn,
  )

  const visible = useMemo(
    () => events.filter((e) => settings.visible[e.owner]),
    [events, settings.visible],
  )

  const openEvent = useCallback((event: AppEvent) => setSheet({ event }), [])

  const openNew = useCallback(
    (seed?: SheetSeed) => {
      const base = seed ?? {
        start: withTime(selected, new Date()),
        end: withTime(selected, new Date(Date.now() + 3600_000)),
      }
      setSheet({ event: null, seed: base })
    },
    [selected],
  )

  const goToday = () => {
    const today = startOfDay(new Date())
    setCursor(today)
    setSelected(today)
  }

  const step = (dir: 1 | -1) => {
    setCursor((c) => {
      switch (view) {
        case 'month':
          return addMonths(c, dir)
        case 'week':
          return addDays(c, dir * 7)
        default:
          return addDays(c, dir * 14)
      }
    })
  }

  if (checking || !ready) {
    return (
      <Shell>
        <div className="flex flex-1 items-center justify-center">
          <span className="h-8 w-8 animate-pulse rounded-full bg-gradient-to-br from-sky-300 to-emerald-300" />
        </div>
      </Shell>
    )
  }

  if (!signedIn) {
    return (
      <Shell>
        <Login onLogin={login} error={authError} busy={false} />
      </Shell>
    )
  }

  if (!isConfigured(settings)) {
    return (
      <Shell>
        <SetupCalendars settings={settings} onChange={update} onSignOut={logout} />
      </Shell>
    )
  }

  if (showSettings) {
    return (
      <Shell>
        <SettingsView
          settings={settings}
          onChange={update}
          onDone={() => setShowSettings(false)}
          onSignOut={logout}
          onReload={reload}
        />
      </Shell>
    )
  }

  return (
    <Shell>
      <header
        className="shrink-0 border-b border-white/10 px-3 pb-2"
        style={{ paddingTop: 'calc(var(--safe-top) + 0.5rem)' }}
      >
        <div className="mb-2.5">
          <DaysCounter />
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => step(-1)}
            className="tap h-8 w-8 shrink-0 rounded-lg text-white/50 hover:bg-white/5"
            aria-label="Anterior"
          >
            ‹
          </button>
          <h1 className="min-w-0 flex-1 truncate text-center text-sm font-semibold first-letter:uppercase">
            {view === 'month' ? fmt.monthYear(cursor) : rangeLabel(range.from, range.to)}
          </h1>
          <button
            type="button"
            onClick={() => step(1)}
            className="tap h-8 w-8 shrink-0 rounded-lg text-white/50 hover:bg-white/5"
            aria-label="Siguiente"
          >
            ›
          </button>
          <button
            type="button"
            onClick={goToday}
            className="tap shrink-0 rounded-lg px-2 py-1 text-xs text-white/50 hover:bg-white/5"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="tap h-8 w-8 shrink-0 rounded-lg text-white/40 hover:bg-white/5"
            aria-label="Ajustes"
          >
            ⚙
          </button>
        </div>

        {/* Filtros por persona */}
        <div className="mt-1.5 flex items-center gap-1.5">
          {OWNERS.map((owner) => {
            const style = OWNER_STYLES[owner]
            const on = settings.visible[owner]
            return (
              <button
                key={owner}
                type="button"
                onClick={() =>
                  update({ visible: { ...settings.visible, [owner]: !on } })
                }
                className={`tap flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-1 text-[11px] font-medium transition ${
                  on ? style.chip : 'border-white/5 text-white/25'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${on ? style.dot : 'bg-white/20'}`} />
                {style.label}
              </button>
            )
          })}
          {loading && <span className="animate-pulse text-xs text-white/30">·</span>}
        </div>
      </header>

      {error && (
        <div
          className={`shrink-0 px-3 py-1.5 text-[11px] ${
            offline ? 'bg-amber-500/15 text-amber-200' : 'bg-red-500/15 text-red-200'
          }`}
        >
          {error}
        </div>
      )}

      {view === 'month' && (
        <MonthView
          cursor={cursor}
          events={visible}
          selected={selected}
          onSelectDay={setSelected}
          onOpenEvent={openEvent}
        />
      )}
      {view === 'week' && (
        <WeekView
          cursor={cursor}
          events={visible}
          onOpenEvent={openEvent}
          onSelectDay={(d) => {
            setSelected(d)
            setCursor(d)
            setView('month')
          }}
        />
      )}
      {view === 'agenda' && (
        <AgendaView from={range.from} to={range.to} events={visible} onOpenEvent={openEvent} />
      )}
      {view === 'free' && (
        <FreeSlotsView
          from={range.from}
          to={range.to}
          events={visible}
          minMinutes={settings.minFreeSlotMinutes}
          onMinMinutesChange={(m) => update({ minFreeSlotMinutes: m })}
          onPickSlot={(start, end) =>
            openNew({ start, end, owner: pickOursOwner(settings.calendars), tags: ['cita'] })
          }
        />
      )}

      {/* Barra inferior + boton de crear */}
      <nav
        className="relative shrink-0 border-t border-white/10 bg-[#0d1b24]"
        style={{ paddingBottom: 'var(--safe-bottom)' }}
      >
        <button
          type="button"
          onClick={() => openNew()}
          className="tap absolute -top-7 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-sky-300 to-emerald-300 text-2xl font-light text-slate-900 shadow-lg shadow-black/40"
          aria-label="Nuevo evento"
        >
          ＋
        </button>

        <div className="flex">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              className={`tap flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition ${
                view === v.id ? 'text-sky-200' : 'text-white/35'
              }`}
            >
              <span className="text-base leading-none">{v.icon}</span>
              {v.label}
            </button>
          ))}
          {/* Hueco para que el boton flotante no tape la ultima pestaña. */}
          <div className="w-16 shrink-0" />
        </div>
      </nav>

      {sheet && (
        <EventSheet
          settings={settings}
          event={sheet.event}
          seed={sheet.seed}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null)
            reload()
          }}
        />
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full min-h-0 flex-col">{children}</div>
}

/** Coge el dia de `day` y la hora de `time`, redondeada a la media hora. */
function withTime(day: Date, time: Date): Date {
  const out = new Date(day)
  out.setHours(time.getHours(), time.getMinutes() > 30 ? 30 : 0, 0, 0)
  return out
}

function rangeLabel(from: Date, to: Date): string {
  return `${fmt.dayShort(from)} – ${fmt.dayShort(to)}`
}

/** Al crear desde un hueco libre, el evento es de los dos si se puede. */
function pickOursOwner(calendars: { ours?: { editable: boolean } }): Owner | undefined {
  return calendars.ours?.editable ? 'ours' : undefined
}
