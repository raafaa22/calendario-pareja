import { useState } from 'react'
import { ensureAnniversaries } from '../lib/anniversaries'
import { RELATIONSHIP_START } from '../lib/config'
import { clearEventCache, type Settings } from '../lib/storage'
import SetupCalendars from './SetupCalendars'

const REMINDER_PRESETS = [
  { minutes: 0, label: 'A la hora' },
  { minutes: 10, label: '10 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 h' },
  { minutes: 1440, label: '1 día' },
]

interface Props {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  onDone: () => void
  onSignOut: () => void
  onReload: () => void
}

export default function SettingsView({ settings, onChange, onDone, onSignOut, onReload }: Props) {
  const [annivBusy, setAnnivBusy] = useState(false)
  const [annivMsg, setAnnivMsg] = useState<string | null>(null)

  const oursId = settings.calendars.ours?.id

  async function handleAnniversaries() {
    if (!oursId) return
    setAnnivBusy(true)
    setAnnivMsg(null)
    try {
      const { created, skipped } = await ensureAnniversaries(oursId)
      const parts: string[] = []
      if (created.length) parts.push(`Añadido ${created.join(' y ')}.`)
      if (skipped.length) parts.push(`Ya estaba puesto ${skipped.join(' y ')}.`)
      setAnnivMsg(parts.join(' '))
      clearEventCache()
      onReload()
    } catch (e) {
      setAnnivMsg(e instanceof Error ? e.message : 'No se ha podido crear')
    } finally {
      setAnnivBusy(false)
    }
  }

  const toggleReminder = (minutes: number) =>
    onChange({
      defaultReminders: settings.defaultReminders.includes(minutes)
        ? settings.defaultReminders.filter((m) => m !== minutes)
        : [...settings.defaultReminders, minutes].sort((a, b) => a - b),
    })

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <SetupCalendars
        settings={settings}
        onChange={onChange}
        onDone={onDone}
        onSignOut={onSignOut}
      />

      <div className="mx-auto max-w-lg px-4 pb-8">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
          <h2 className="text-sm font-semibold">Aniversarios</h2>
          <p className="mt-1 text-[11px] leading-snug text-white/40">
            Crea en «Nosotros» dos eventos recurrentes: uno cada día{' '}
            {RELATIONSHIP_START.getDate()} del mes y otro cada{' '}
            {RELATIONSHIP_START.getDate()} de noviembre. Con aviso, para que os
            llegue a los dos móviles.
          </p>
          <button
            type="button"
            onClick={handleAnniversaries}
            disabled={!oursId || annivBusy}
            className="tap mt-2.5 w-full rounded-xl border border-emerald-300/40 bg-emerald-400/15 py-2.5 text-sm font-medium text-emerald-50 disabled:opacity-40"
          >
            {annivBusy ? 'Creando…' : 'Crear los aniversarios'}
          </button>
          {!oursId && (
            <p className="mt-2 text-[11px] text-amber-300/70">
              Asigna primero el calendario «Nosotros».
            </p>
          )}
          {annivMsg && <p className="mt-2 text-[11px] leading-snug text-white/55">{annivMsg}</p>}
        </section>

        <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
          <h2 className="text-sm font-semibold">Avisos por defecto</h2>
          <p className="mt-1 text-[11px] text-white/40">
            Los que se marcan solos al crear un evento nuevo.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {REMINDER_PRESETS.map(({ minutes, label }) => {
              const active = settings.defaultReminders.includes(minutes)
              return (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => toggleReminder(minutes)}
                  className={`tap rounded-full border px-2.5 py-1 text-xs transition ${
                    active
                      ? 'border-emerald-300/50 bg-emerald-400/20 text-emerald-100'
                      : 'border-white/10 text-white/45'
                  }`}
                >
                  {active ? '🔔 ' : ''}
                  {label}
                </button>
              )
            })}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
          <h2 className="text-sm font-semibold">Datos guardados</h2>
          <p className="mt-1 text-[11px] leading-snug text-white/40">
            La app no tiene servidor. Lo único que guarda en este móvil es qué
            calendario es de quién, y una copia de los eventos para poder
            consultarlos sin conexión.
          </p>
          <button
            type="button"
            onClick={() => {
              clearEventCache()
              onReload()
              setAnnivMsg('Copia local borrada.')
            }}
            className="tap mt-2.5 w-full rounded-xl border border-white/10 py-2.5 text-sm text-white/55"
          >
            Borrar la copia sin conexión
          </button>
        </section>
      </div>
    </div>
  )
}
