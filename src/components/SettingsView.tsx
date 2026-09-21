import { useState } from 'react'
import { ensureAnniversaries } from '../lib/anniversaries'
import type { Profile } from '../lib/auth'
import { RELATIONSHIP_START } from '../lib/config'
import { ownerLabels } from '../lib/labels'
import { DEFAULT_APP_NAME, clearEventCache, type Settings } from '../lib/storage'
import {
  ACCENTS,
  ACCENT_LABELS,
  ACCENT_TRIAD,
  DEFAULT_CUSTOM_COLORS,
  THEMES,
  THEME_LABELS,
  hueDistance,
  resolveChrome,
  resolveOurs,
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
  const labels = ownerLabels(settings)
  const [annivBusy, setAnnivBusy] = useState(false)
  const [annivMsg, setAnnivMsg] = useState<string | null>(null)

  const oursId = settings.calendars.ours?.id

  // Colores a medida: "Nosotros" y el de la interfaz pueden ser elegidos o
  // calculados.
  const custom = settings.customColors
  const ourColor = resolveOurs(custom)
  const chromeColor = resolveChrome(custom)
  const customTriad: [string, string, string] = [custom.mine, custom.hers, ourColor]
  // Por debajo de 45 grados de separacion los chips se confunden.
  const tooClose = hueDistance(custom.mine, custom.hers) < 45
  // Y si la interfaz se parece a algun color del calendario, tampoco se
  // distinguen los botones de los eventos.
  const chromeTooClose =
    Math.min(
      hueDistance(chromeColor, custom.mine),
      hueDistance(chromeColor, custom.hers),
      hueDistance(chromeColor, ourColor),
    ) < 40

  const setCustom = (patch: Partial<typeof custom>) =>
    onChange({ customColors: { ...custom, ...patch } })

  /**
   * Los tres colores de un tema —el de cada uno y la mezcla— en el
   * orden en que estan repartidos ahora mismo.
   */
  const triadFor = (a: Accent): [string, string, string] => {
    if (a === 'propio') return customTriad
    const [p1, p2, p3] = ACCENT_TRIAD[a]
    return settings.swapPeople ? [p2, p1, p3] : [p1, p2, p3]
  }

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
          <section className="mb-4 flex items-center gap-3 rounded-3xl border border-line bg-surface p-3.5 shadow-card">
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

        <section className="rounded-3xl border border-line bg-surface p-3.5 shadow-card">
          <h2 className="text-sm font-extrabold">Nombre</h2>
          <p className="mt-1 text-[11px] leading-snug text-subtle">
            Como se llama vuestro calendario. Sale en la cabecera y en la
            pantalla de entrada.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <input
              value={settings.appName}
              onChange={(e) => onChange({ appName: e.target.value.slice(0, 32) })}
              placeholder={DEFAULT_APP_NAME}
              className="min-w-0 flex-1 rounded-2xl border border-line bg-elevated px-3.5 py-2.5 text-sm font-bold outline-none placeholder:font-normal placeholder:text-subtle focus:border-accent-line"
            />
            {settings.appName !== DEFAULT_APP_NAME && (
              <button
                type="button"
                onClick={() => onChange({ appName: DEFAULT_APP_NAME })}
                className="tap shrink-0 rounded-2xl border border-line px-3 py-2.5 text-xs font-semibold text-muted"
              >
                Por defecto
              </button>
            )}
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-line bg-surface p-3.5 shadow-card">
          <h2 className="text-sm font-extrabold">Aspecto</h2>
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
                className={`tap rounded-2xl border py-2.5 text-xs font-bold transition ${
                  settings.theme === t
                    ? 'border-accent-line bg-accent-soft text-accent'
                    : 'border-line text-subtle'
                }`}
              >
                {THEME_LABELS[t]}
              </button>
            ))}
          </div>

          <div className="mt-3.5 text-[11px] font-medium text-muted">Color</div>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {ACCENTS.map((a: Accent) => {
              const dots = triadFor(a)
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => onChange({ accent: a })}
                  className={`tap flex items-center justify-between gap-2 rounded-2xl border px-2.5 py-2.5 text-xs font-bold transition ${
                    settings.accent === a
                      ? 'border-accent-line bg-accent-soft text-accent'
                      : 'border-line text-subtle'
                  }`}
                >
                  <span className="truncate">{ACCENT_LABELS[a]}</span>
                  {/* Los tres colores del calendario de ese tema, para verlos
                      antes de elegir. */}
                  <span className="flex shrink-0 gap-0.5">
                    {dots.map((c, i) => (
                      <span
                        key={i}
                        className="h-3 w-3 rounded-full ring-1 ring-black/10"
                        style={{ background: c }}
                      />
                    ))}
                  </span>
                </button>
              )
            })}
          </div>

          {settings.accent === 'propio' ? (
            <div className="mt-2.5 rounded-2xl border border-line bg-elevated p-3">
              <ColorRow label={labels.mine} value={custom.mine} onChange={(v) => setCustom({ mine: v })} />
              <ColorRow label={labels.hers} value={custom.hers} onChange={(v) => setCustom({ hers: v })} />
              <ColorRow
                label={labels.ours}
                value={ourColor}
                auto={custom.ours === null}
                autoHint="mezcla de los dos"
                onChange={(v) => setCustom({ ours: v })}
                onAuto={() => setCustom({ ours: null })}
              />
              <ColorRow
                label="Interfaz"
                value={chromeColor}
                auto={custom.chrome === null}
                autoHint="opuesto a Nosotros"
                onChange={(v) => setCustom({ chrome: v })}
                onAuto={() => setCustom({ chrome: null })}
              />

              {tooClose && (
                <p className="mt-2 text-[11px] leading-snug text-warn">
                  Los dos colores de persona son muy parecidos: cuesta
                  distinguir de quién es cada evento.
                </p>
              )}
              {chromeTooClose && (
                <p className="mt-2 text-[11px] leading-snug text-warn">
                  El color de la interfaz se parece a uno del calendario, así que
                  los botones y el día de hoy se confundirán con los eventos.
                </p>
              )}
              <p className="mt-2 text-[11px] leading-snug text-subtle">
                «Nosotros» se calcula como la mezcla de los dos, mezclando el
                tono igual que se mezcla pintura (azul + amarillo = verde). El de
                la interfaz sale del opuesto a «Nosotros», para que no se
                parezcan. Los dos se pueden fijar a mano.
              </p>
              <button
                type="button"
                onClick={() => onChange({ customColors: DEFAULT_CUSTOM_COLORS })}
                className="tap mt-2 w-full rounded-xl border border-line bg-surface py-2 text-xs font-semibold text-muted"
              >
                Volver a los de fábrica
              </button>
            </div>
          ) : (
            <>
              {/* Dentro de un tema, elegir cual de los dos colores quiere cada uno. */}
              <button
                type="button"
                onClick={() => onChange({ swapPeople: !settings.swapPeople })}
                className="tap mt-2.5 flex w-full items-center gap-3 rounded-2xl border border-line bg-elevated px-3 py-2.5"
              >
                {([labels.mine, labels.hers] as const).map((who, i) => (
                  <span key={who} className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10"
                      style={{ background: triadFor(settings.accent)[i] }}
                    />
                    <span className="truncate text-xs font-bold">{who}</span>
                  </span>
                ))}
                <span className="ml-auto shrink-0 text-xs font-bold text-accent">
                  ⇄ Intercambiar
                </span>
              </button>
              <p className="mt-2 text-[11px] leading-snug text-subtle">
                Los eventos van en los tres colores del tema, y el tercero es la
                mezcla de los dos primeros. Están en el lado opuesto al color de
                la interfaz para que «Nosotros» no se confunda con los botones ni
                con el día de hoy.
              </p>
            </>
          )}
        </section>

        <section className="mt-4 rounded-3xl border border-line bg-surface p-3.5 shadow-card">
          <h2 className="text-sm font-extrabold">La vista de mes</h2>
          <p className="mt-1 text-[11px] leading-snug text-subtle">
            Cada día del mes es una celda de unos 48 px, así que hay sitio para
            unas 10 letras. La hora y el emoji gastan 2 o 3 cada uno, y lo que
            sobra es para el nombre.
          </p>

          <div className="mt-2.5 flex flex-col gap-2">
            {(
              [
                ['monthShowTime', 'Mostrar la hora'],
                ['monthShowEmoji', 'Mostrar el emoji'],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center justify-between rounded-2xl border border-line bg-elevated px-3 py-2.5"
              >
                <span className="text-sm font-semibold">{label}</span>
                <input
                  type="checkbox"
                  checked={settings[key]}
                  onChange={(e) => onChange({ [key]: e.target.checked })}
                  className="h-5 w-5 accent-accent"
                />
              </label>
            ))}
          </div>

          {/* Vista previa con un nombre largo, que es donde se nota el recorte. */}
          <div className="mt-2.5 flex items-center gap-2">
            <span className="shrink-0 text-[11px] font-medium text-muted">Así se ve:</span>
            <span className="w-[46px] shrink-0 truncate rounded-[5px] border px-[2px] py-[1px] text-left text-[8px] font-semibold leading-[1.5] tracking-[-0.02em] chip-ours">
              {settings.monthShowEmoji && <span className="mr-[1px]">🍽️</span>}
              {settings.monthShowTime && <span className="font-extrabold tabular-nums">21 </span>}
              Cena con Ana
            </span>
          </div>

          {settings.monthShowTime && settings.monthShowEmoji && (
            <p className="mt-2 text-[11px] leading-snug text-warn">
              Con las dos cosas puestas casi no queda sitio para el nombre.
            </p>
          )}
        </section>

        <section className="mt-4 rounded-3xl border border-line bg-surface p-3.5 shadow-card">
          <h2 className="text-sm font-extrabold">Aniversarios</h2>
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
            className="tap mt-2.5 w-full rounded-2xl border border-accent-line bg-accent-soft py-3 text-sm font-bold text-accent disabled:opacity-40"
          >
            {annivBusy ? 'Creando…' : 'Crear los aniversarios ❤️'}
          </button>
          {!oursId && (
            <p className="mt-2 text-[11px] text-warn">Asigna primero el calendario «Nosotros».</p>
          )}
          {annivMsg && <p className="mt-2 text-[11px] leading-snug text-muted">{annivMsg}</p>}
        </section>

        <section className="mt-4 rounded-3xl border border-line bg-surface p-3.5 shadow-card">
          <h2 className="text-sm font-extrabold">Avisos por defecto</h2>
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
        </section>
      </div>

      <SetupCalendars
        settings={settings}
        onChange={onChange}
        onDone={onDone}
        onSignOut={onSignOut}
      />

      <div className="mx-auto max-w-lg px-4 pb-8">
        <section className="rounded-3xl border border-line bg-surface p-3.5 shadow-card">
          <h2 className="text-sm font-extrabold">Datos guardados</h2>
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
            className="tap mt-2.5 w-full rounded-2xl border border-line py-2.5 text-sm font-semibold text-muted"
          >
            Borrar la copia sin conexión
          </button>
        </section>
      </div>
    </div>
  )
}

/**
 * Fila con el selector de color nativo del sistema, que en movil abre la rueda
 * de colores del propio telefono.
 */
function ColorRow({
  label,
  value,
  onChange,
  auto,
  autoHint,
  onAuto,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  /** Para los que pueden calcularse solos: indica si ahora lo estan. */
  auto?: boolean
  autoHint?: string
  onAuto?: () => void
}) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <label className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-line">
        <span className="absolute inset-0" style={{ background: value }} />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={`Color de ${label}`}
        />
      </label>
      <span className="min-w-0 flex-1 text-xs font-bold">
        {label}
        {auto && autoHint && (
          <span className="ml-1.5 font-normal text-subtle">auto · {autoHint}</span>
        )}
      </span>
      {auto === false && onAuto && (
        <button
          type="button"
          onClick={onAuto}
          className="tap shrink-0 rounded-lg border border-line px-2 py-1 text-[11px] font-semibold text-muted"
        >
          Automático
        </button>
      )}
    </div>
  )
}
