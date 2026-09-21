import { useState } from 'react'
import { ensureAnniversaries } from '../lib/anniversaries'
import type { Profile } from '../lib/auth'
import { RELATIONSHIP_START } from '../lib/config'
import { clearEventCache, type Settings } from '../lib/storage'
import {
  ACCENTS,
  ACCENT_LABELS,
  ACCENT_SWATCH,
  THEMES,
  THEME_LABELS,
  type Accent,
  type Theme,
} from '../lib/theme'
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
  profile: Profile | null
  onChange: (patch: Partial<Settings>) => void
  onDone: () => void
  onSignOut: () => void
  onReload: () => void
}

export default function SettingsView({
  settings,
  profile,
  onChange,
  onDone,
  onSignOut,
  onReload,
}: Props) {
  const [annivBusy, setAnnivBusy] = useState(false)
  const [annivMsg, setAnnivMsg] = useState<string | null>(null)

  const oursId = settings.calendars.ours?.id

  async function handleAnniversaries() {
    if (!oursId) return
    setAnnivBusy(true)
    setAnnivMsg(null)
    try {
      const { created, updated, skipped } = await ensureAnniversaries(oursId)
      const parts: string[] = []
      if (created.length) parts.push(`Añadido ${created.join(' y ')}.`)
      if (updated.length) parts.push(`Corregido ${updated.join(' y ')}.`)
      if (skipped.length) parts.push(`Ya estaba bien ${skipped.join(' y ')}.`)
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
      <div className="mx-auto max-w-lg px-4 pt-5">
        {/* Quien esta usando la app, y de quien son estos ajustes. */}
        {profile && (
          <section className="mb-4 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
            {profile.picture ? (
              <img
                src={profile.picture}
                alt=""
                referrerPolicy="no-referrer"
                className="h-10 w-10 shrink-0 rounded-full"
              />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                {profile.givenName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{profile.name}</div>
              <div className="truncate text-[11px] text-subtle">{profile.email}</div>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-line bg-surface p-3.5">
          <h2 className="text-sm font-semibold">Aspecto</h2>
          <p className="mt-1 text-[11px] leading-snug text-subtle">
            Es tuyo, no del calendario: cada uno lo elige en su cuenta y no
            afecta a lo que ve el otro.
          </p>

          <div className="mt-3 text-[11px] font-medium text-muted">Tema</div>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {THEMES.map((t: Theme) => (
              <button
                key={t}
                type="button"
                onClick={() => onChange({ theme: t })}
                className={`tap rounded-xl border py-2 text-xs font-medium transition ${
                  settings.theme === t
                    ? 'border-accent-line bg-accent-soft text-accent'
                    : 'border-line text-subtle'
                }`}
              >
                {THEME_LABELS[t]}
              </button>
            ))}
          </div>

          <div className="mt-3 text-[11px] font-medium text-muted">Color</div>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {ACCENTS.map((a: Accent) => (
              <button
                key={a}
                type="button"
                onClick={() => onChange({ accent: a })}
                className={`tap flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-medium transition ${
                  settings.accent === a
                    ? 'border-accent-line bg-accent-soft text-accent'
                    : 'border-line text-subtle'
                }`}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: ACCENT_SWATCH[a] }}
                />
                {ACCENT_LABELS[a]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-subtle">
            El color de cada persona en los eventos no cambia, para que los dos
            veáis el mismo color para la misma persona.
          </p>
        </section>

        <section className="mt-4 rounded-2xl border border-line bg-surface p-3.5">
          <h2 className="text-sm font-semibold">Aniversarios</h2>
          <p className="mt-1 text-[11px] leading-snug text-subtle">
            Crea en «Nosotros» dos eventos recurrentes: uno cada día{' '}
            {RELATIONSHIP_START.getDate()} del mes y otro cada{' '}
            {RELATIONSHIP_START.getDate()} de noviembre. El mensual se salta
            noviembre para que ese día no salgan los dos.
          </p>
          <button
            type="button"
            onClick={handleAnniversaries}
            disabled={!oursId || annivBusy}
            className="tap mt-2.5 w-full rounded-xl border border-accent-line bg-accent-soft py-2.5 text-sm font-medium text-accent disabled:opacity-40"
          >
            {annivBusy ? 'Creando…' : 'Crear los aniversarios ❤️'}
          </button>
          {!oursId && (
            <p className="mt-2 text-[11px] text-warn">Asigna primero el calendario «Nosotros».</p>
          )}
          {annivMsg && <p className="mt-2 text-[11px] leading-snug text-muted">{annivMsg}</p>}
        </section>

        <section className="mt-4 rounded-2xl border border-line bg-surface p-3.5">
          <h2 className="text-sm font-semibold">Avisos por defecto</h2>
          <p className="mt-1 text-[11px] text-subtle">
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
        </section>
      </div>

      <SetupCalendars
        settings={settings}
        onChange={onChange}
        onDone={onDone}
        onSignOut={onSignOut}
      />

      <div className="mx-auto max-w-lg px-4 pb-8">
        <section className="rounded-2xl border border-line bg-surface p-3.5">
          <h2 className="text-sm font-semibold">Datos guardados</h2>
          <p className="mt-1 text-[11px] leading-snug text-subtle">
            La app no tiene servidor. En este móvil solo guarda qué calendario
            es de quién, tus preferencias de aspecto y una copia de los eventos
            para poder consultarlos sin conexión.
          </p>
          <button
            type="button"
            onClick={() => {
              clearEventCache()
              onReload()
              setAnnivMsg('Copia local borrada.')
            }}
            className="tap mt-2.5 w-full rounded-xl border border-line py-2.5 text-sm text-muted"
          >
            Borrar la copia sin conexión
          </button>
        </section>
      </div>
    </div>
  )
}
