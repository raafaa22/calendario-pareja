import { useState } from 'react'
import {
  TITLE as ANNIVERSARY_TITLE,
  countAnniversaries,
  ensureAnniversaries,
  removeAllAnniversaries,
  type Progress,
} from '../lib/anniversaries'
import type { Profile } from '../lib/auth'
import { OWNERS, RELATIONSHIP_START } from '../lib/config'
import { deleteCalendar, listCalendars, type GCalCalendar } from '../lib/gcal'
import { elapsedLabel } from '../lib/dates'
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

/**
 * Los ajustes van repartidos en secciones, cada una en su pantalla. En una
 * sola lista habia que bajar media pagina para llegar a lo de siempre, y el
 * boton de volver al calendario quedaba enterrado al final.
 */
type Section =
  | 'calendars'
  | 'appearance'
  | 'month'
  | 'anniversaries'
  | 'reminders'
  | 'cleanup'
  | 'general'

const SECTION_TITLES: Record<Section, string> = {
  calendars: 'Los calendarios',
  appearance: 'Aspecto',
  month: 'La vista de mes',
  anniversaries: 'Aniversarios',
  reminders: 'Avisos por defecto',
  cleanup: 'Limpieza',
  general: 'Nombre y datos',
}

interface Props {
  settings: Settings
  profile: Profile | null
  onChange: (patch: Partial<Settings>) => void
  onDone: () => void
  onRestart: () => void
  onSignOut: () => void
  onReload: () => void
}

export default function SettingsView({
  settings,
  profile,
  onChange,
  onDone,
  onRestart,
  onSignOut,
  onReload,
}: Props) {
  const [section, setSection] = useState<Section | null>(null)
  const labels = ownerLabels(settings)

  const back = () => (section ? setSection(null) : onDone())

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header
        className="flex shrink-0 items-center gap-1 border-b border-line px-2 pb-2"
        style={{ paddingTop: 'calc(var(--safe-top) + 0.5rem)' }}
      >
        <button
          type="button"
          onClick={back}
          aria-label={section ? 'Volver a ajustes' : 'Volver al calendario'}
          className="tap flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-muted hover:bg-elevated"
        >
          ←
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-extrabold">
          {section ? SECTION_TITLES[section] : 'Ajustes'}
        </h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {section === null && (
          <Menu
            settings={settings}
            profile={profile}
            labels={labels}
            onOpen={setSection}
          />
        )}
        {section === 'calendars' && (
          <SetupCalendars
            settings={settings}
            onChange={onChange}
            onDone={() => setSection(null)}
            onRestart={onRestart}
            onSignOut={onSignOut}
          />
        )}
        {section === 'appearance' && <Appearance settings={settings} onChange={onChange} />}
        {section === 'month' && <MonthOptions settings={settings} onChange={onChange} />}
        {section === 'anniversaries' && (
          <Anniversaries settings={settings} onReload={onReload} />
        )}
        {section === 'reminders' && <Reminders settings={settings} onChange={onChange} />}
        {section === 'cleanup' && <Cleanup settings={settings} onReload={onReload} />}
        {section === 'general' && (
          <General
            settings={settings}
            onChange={onChange}
            onReload={onReload}
            onSignOut={onSignOut}
          />
        )}
      </div>
    </div>
  )
}

/* ---------- el menú ---------- */

function Menu({
  settings,
  profile,
  labels,
  onOpen,
}: {
  settings: Settings
  profile: Profile | null
  labels: Record<'mine' | 'hers' | 'ours', string>
  onOpen: (s: Section) => void
}) {
  // Cada fila enseña en qué está ahora mismo, para no tener que entrar a mirar.
  const monthSummary = settings.monthShowEmoji
    ? settings.monthShowTime
      ? 'Hora y emoji'
      : 'Emoji'
    : settings.monthShowTime
      ? 'Hora'
      : 'Solo el nombre'

  const reminderSummary = settings.defaultReminders.length
    ? settings.defaultReminders
        .map((m) => REMINDER_PRESETS.find((p) => p.minutes === m)?.label ?? `${m} min`)
        .join(' · ')
    : 'Sin avisos'

  return (
    <div className="mx-auto max-w-lg px-4 py-4">
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

      <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
        <Row
          icon="📅"
          title="Los calendarios"
          value={`${labels.mine} · ${labels.hers} · ${labels.ours}`}
          onClick={() => onOpen('calendars')}
        />
        <Row
          icon="🎨"
          title="Aspecto"
          value={`${THEME_LABELS[settings.theme]} · ${ACCENT_LABELS[settings.accent]}`}
          onClick={() => onOpen('appearance')}
        />
        <Row
          icon="🗓️"
          title="La vista de mes"
          value={monthSummary}
          onClick={() => onOpen('month')}
        />
        <Row
          icon="🐣"
          title="Aniversarios"
          value={`Cada día ${RELATIONSHIP_START.getDate()} y cada año`}
          onClick={() => onOpen('anniversaries')}
        />
        <Row
          icon="🔔"
          title="Avisos por defecto"
          value={reminderSummary}
          onClick={() => onOpen('reminders')}
        />
        <Row
          icon="🧹"
          title="Limpieza"
          value="Borrar aniversarios y calendarios sueltos"
          onClick={() => onOpen('cleanup')}
        />
        <Row
          icon="⚙️"
          title="Nombre y datos"
          value={settings.appName}
          onClick={() => onOpen('general')}
          last
        />
      </div>
    </div>
  )
}

function Row({
  icon,
  title,
  value,
  onClick,
  last,
}: {
  icon: string
  title: string
  value: string
  onClick: () => void
  last?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-elevated ${
        last ? '' : 'border-b border-line'
      }`}
    >
      <span className="shrink-0 text-lg leading-none">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-subtle">{value}</span>
      </span>
      <span className="shrink-0 text-lg text-subtle">›</span>
    </button>
  )
}

/** Caja con título, para el contenido de cada sección. */
function Card({ title, hint, children }: { title?: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-3.5 shadow-card">
      {title && <h2 className="text-sm font-extrabold">{title}</h2>}
      {hint && <p className="mt-1 text-[11px] leading-snug text-subtle">{hint}</p>}
      <div className={title || hint ? 'mt-2.5' : ''}>{children}</div>
    </section>
  )
}

function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-4">{children}</div>
}

/* ---------- aspecto ---------- */

function Appearance({
  settings,
  onChange,
}: {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
}) {
  const custom = settings.customColors
  const ourColor = resolveOurs(custom)
  const chromeColor = resolveChrome(custom)
  const customTriad: [string, string, string] = [custom.mine, custom.hers, ourColor]
  const labels = ownerLabels(settings)

  const tooClose = hueDistance(custom.mine, custom.hers) < 45
  const chromeTooClose =
    Math.min(
      hueDistance(chromeColor, custom.mine),
      hueDistance(chromeColor, custom.hers),
      hueDistance(chromeColor, ourColor),
    ) < 40

  const setCustom = (patch: Partial<typeof custom>) =>
    onChange({ customColors: { ...custom, ...patch } })

  /** Los tres colores de un tema, en el orden repartido ahora mismo. */
  const triadFor = (a: Accent): [string, string, string] => {
    if (a === 'propio') return customTriad
    const [p1, p2, p3] = ACCENT_TRIAD[a]
    return settings.swapPeople ? [p2, p1, p3] : [p1, p2, p3]
  }

  return (
    <Page>
      <Card hint="Es tuyo, no del calendario: cada uno lo elige en su cuenta y no afecta a lo que ve el otro.">
        <div className="text-[11px] font-medium text-muted">Tema</div>
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
      </Card>

      <Card title="Color">
        <div className="grid grid-cols-2 gap-2">
          {ACCENTS.map((a: Accent) => (
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
              <span className="flex shrink-0 gap-0.5">
                {triadFor(a).map((c, i) => (
                  <span
                    key={i}
                    className="h-3 w-3 rounded-full ring-1 ring-black/10"
                    style={{ background: c }}
                  />
                ))}
              </span>
            </button>
          ))}
        </div>

        {settings.accent === 'propio' ? (
          <div className="mt-2.5 rounded-2xl border border-line bg-elevated p-3">
            <ColorRow
              label={labels.mine}
              value={custom.mine}
              onChange={(v) => setCustom({ mine: v })}
            />
            <ColorRow
              label={labels.hers}
              value={custom.hers}
              onChange={(v) => setCustom({ hers: v })}
            />
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
                Los dos colores de persona son muy parecidos: cuesta distinguir
                de quién es cada evento.
              </p>
            )}
            {chromeTooClose && (
              <p className="mt-2 text-[11px] leading-snug text-warn">
                El color de la interfaz se parece a uno del calendario, así que
                los botones y el día de hoy se confundirán con los eventos.
              </p>
            )}
            <p className="mt-2 text-[11px] leading-snug text-subtle">
              «Nosotros» se calcula como la mezcla de los dos, mezclando el tono
              igual que se mezcla pintura (azul + amarillo = verde). El de la
              interfaz sale del opuesto a «Nosotros», para que no se parezcan.
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
              <span className="ml-auto shrink-0 text-xs font-bold text-accent">⇄ Intercambiar</span>
            </button>
            <p className="mt-2 text-[11px] leading-snug text-subtle">
              El tercer color es la mezcla de los dos primeros. Están en el lado
              opuesto al color de la interfaz para que «Nosotros» no se confunda
              con los botones ni con el día de hoy.
            </p>
          </>
        )}
      </Card>
    </Page>
  )
}

/* ---------- vista de mes ---------- */

function MonthOptions({
  settings,
  onChange,
}: {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
}) {
  return (
    <Page>
      <Card hint="Cada día del mes es una celda de unos 48 px, así que hay sitio para unas 10 letras. La hora y el emoji gastan 2 o 3 cada uno, y lo que sobra es para el nombre.">
        <div className="flex flex-col gap-2">
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

        <div className="mt-3 flex items-center gap-2">
          <span className="shrink-0 text-[11px] font-medium text-muted">Así se ve:</span>
          <span className="chip-ours w-[46px] shrink-0 truncate rounded-[5px] border px-[2px] py-[1px] text-left text-[8px] font-semibold leading-[1.5] tracking-[-0.02em]">
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
      </Card>
    </Page>
  )
}

/* ---------- aniversarios ---------- */

function Anniversaries({ settings, onReload }: { settings: Settings; onReload: () => void }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const oursId = settings.calendars.ours?.id

  async function handle() {
    if (!oursId) return
    setBusy(true)
    setMsg(null)
    try {
      const { created, updated, removed } = await ensureAnniversaries(oursId)
      const parts: string[] = []
      if (created.length) parts.push(`Puesto ${created.join(' y ')}.`)
      if (updated.length) parts.push(`Corregido ${updated.join(' y ')}.`)
      if (removed) parts.push(`Quitados ${removed} de versiones anteriores.`)
      if (!parts.length) parts.push('Ya estaban los dos puestos.')
      setMsg(parts.join(' '))
      clearEventCache()
      onReload()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se ha podido crear')
    } finally {
      setBusy(false)
    }
  }

  const day = RELATIONSHIP_START.getDate()
  const month = RELATIONSHIP_START.toLocaleDateString('es-ES', { month: 'long' })

  return (
    <Page>
      <Card
        hint={`Pone en «${ownerLabels(settings).ours}» dos eventos que se repiten solos: uno cada día ${day} del mes y otro cada ${day} de ${month}. El mensual se salta ${month} para que ese día no salgan los dos.`}
      >
        {/* Como se ve en la app, con la cuenta puesta al vuelo. */}
        <div className="flex flex-col gap-1.5">
          {[0, 1].map((i) => {
            const d = new Date(
              RELATIONSHIP_START.getFullYear() + 4,
              RELATIONSHIP_START.getMonth() + (i === 0 ? 0 : 2),
              RELATIONSHIP_START.getDate(),
            )
            return (
              <div
                key={i}
                className="chip-ours truncate rounded-xl border px-2.5 py-1.5 text-center text-sm font-bold"
              >
                {ANNIVERSARY_TITLE} {elapsedLabel(d)}
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={handle}
          disabled={!oursId || busy}
          className="tap mt-3 w-full rounded-2xl border border-accent-line bg-accent-soft py-3 text-sm font-bold text-accent disabled:opacity-40"
        >
          {busy ? 'Poniéndolos…' : 'Poner los aniversarios'}
        </button>

        {!oursId && (
          <p className="mt-2 text-[11px] text-warn">Asigna primero el calendario de los dos.</p>
        )}
        {msg && <p className="mt-2 text-[11px] leading-snug text-muted">{msg}</p>}
        <p className="mt-2 text-[11px] leading-snug text-subtle">
          La cuenta de meses y años <strong>no se guarda</strong> en el evento:
          la pone la app al pintarlo, calculándola por la fecha de cada
          repetición. Por eso en la app de Google los verás solo como{' '}
          {ANNIVERSARY_TITLE}. Así son dos eventos que no caducan nunca, en vez
          de uno por fecha que habría que ir alargando.
        </p>
      </Card>
    </Page>
  )
}

/* ---------- avisos ---------- */

function Reminders({
  settings,
  onChange,
}: {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
}) {
  const toggle = (minutes: number) =>
    onChange({
      defaultReminders: settings.defaultReminders.includes(minutes)
        ? settings.defaultReminders.filter((m) => m !== minutes)
        : [...settings.defaultReminders, minutes].sort((a, b) => a - b),
    })

  return (
    <Page>
      <Card hint="Los que se marcan solos al crear un evento nuevo. Llegan como notificación de Google Calendar al móvil.">
        <div className="flex flex-wrap gap-1.5">
          {REMINDER_PRESETS.map(({ minutes, label }) => {
            const active = settings.defaultReminders.includes(minutes)
            return (
              <button
                key={minutes}
                type="button"
                onClick={() => toggle(minutes)}
                className={`tap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active ? 'border-accent-line bg-accent-soft text-accent' : 'border-line text-subtle'
                }`}
              >
                {active ? '🔔 ' : ''}
                {label}
              </button>
            )
          })}
        </div>
      </Card>
    </Page>
  )
}

/* ---------- nombre y datos ---------- */

function General({
  settings,
  onChange,
  onReload,
  onSignOut,
}: {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  onReload: () => void
  onSignOut: () => void
}) {
  const [msg, setMsg] = useState<string | null>(null)

  return (
    <Page>
      <Card
        title="Nombre"
        hint="Como se llama vuestro calendario. Sale en la cabecera y en la pantalla de entrada."
      >
        <div className="flex items-center gap-2">
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
      </Card>

      <Card
        title="Datos guardados"
        hint="La app no tiene servidor. En este móvil solo guarda qué calendario es de quién, tus preferencias de aspecto y una copia de los eventos para poder consultarlos sin conexión."
      >
        <button
          type="button"
          onClick={() => {
            clearEventCache()
            onReload()
            setMsg('Copia local borrada.')
          }}
          className="tap w-full rounded-2xl border border-line py-2.5 text-sm font-semibold text-muted"
        >
          Borrar la copia sin conexión
        </button>
        {msg && <p className="mt-2 text-[11px] text-muted">{msg}</p>}
      </Card>

      <button
        type="button"
        onClick={onSignOut}
        className="tap rounded-2xl border border-danger-line py-2.5 text-sm font-semibold text-danger"
      >
        Cerrar sesión
      </button>
    </Page>
  )
}

/* ---------- selector de color ---------- */

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
      <span className="min-w-0 flex-1 truncate text-xs font-bold">
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

/* ---------- limpieza ---------- */

/**
 * Lo destructivo, junto y apartado. Son dos cosas distintas y de distinta
 * gravedad: borrar los aniversarios se puede deshacer volviendolos a poner;
 * borrar un calendario de Google se lleva sus eventos y no tiene vuelta.
 */
function Cleanup({ settings, onReload }: { settings: Settings; onReload: () => void }) {
  return (
    <Page>
      <AnniversaryCleanup settings={settings} onReload={onReload} />
      <CalendarCleanup settings={settings} />
    </Page>
  )
}

function AnniversaryCleanup({
  settings,
  onReload,
}: {
  settings: Settings
  onReload: () => void
}) {
  const [count, setCount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const oursId = settings.calendars.ours?.id

  async function count_() {
    if (!oursId) return
    setBusy(true)
    setMsg(null)
    try {
      setCount(await countAnniversaries(oursId))
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se han podido contar')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!oursId) return
    setBusy(true)
    setMsg(null)
    try {
      const n = await removeAllAnniversaries(oursId, setProgress)
      setMsg(`Borrados ${n}.`)
      setCount(0)
      clearEventCache()
      onReload()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se han podido borrar')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <Card
      title="Los aniversarios"
      hint="Borra los que haya puesto la app, tanto los de ahora como los de versiones anteriores. Va por el nombre del evento, así que un evento tuyo etiquetado como aniversario no se toca. Se pueden volver a poner cuando quieras."
    >
      {!oursId ? (
        <p className="text-[11px] text-warn">Asigna primero el calendario de los dos.</p>
      ) : count === null ? (
        <button
          type="button"
          onClick={count_}
          disabled={busy}
          className="tap w-full rounded-2xl border border-line py-2.5 text-sm font-semibold text-muted disabled:opacity-40"
        >
          {busy ? 'Mirando…' : 'Ver cuántos hay'}
        </button>
      ) : count === 0 ? (
        <p className="text-sm font-semibold text-muted">No hay ninguno puesto por la app.</p>
      ) : (
        <>
          <p className="text-sm font-semibold">
            Hay {count} {count === 1 ? 'aniversario' : 'aniversarios'} puestos por la app.
          </p>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="tap mt-2.5 w-full rounded-2xl bg-danger-strong py-2.5 text-sm font-bold text-danger-strong-fg disabled:opacity-50"
          >
            {busy
              ? progress
                ? `Borrando… ${progress.done} de ${progress.total}`
                : 'Borrando…'
              : `Borrar los ${count}`}
          </button>
        </>
      )}
      {msg && <p className="mt-2 text-[11px] leading-snug text-muted">{msg}</p>}
    </Card>
  )
}

function CalendarCleanup({ settings }: { settings: Settings }) {
  const [calendars, setCalendars] = useState<GCalCalendar[] | null>(null)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const inUse = new Set(OWNERS.map((o) => settings.calendars[o]?.id).filter(Boolean) as string[])

  /**
   * Solo se ofrecen los que son tuyos y no estan en uso. El principal no se
   * puede borrar en Google, y los de otra persona no son tuyos para borrarlos.
   */
  const spare = (calendars ?? []).filter(
    (c) => c.accessRole === 'owner' && !c.primary && !inUse.has(c.id),
  )

  async function load() {
    setBusy(true)
    setMsg(null)
    try {
      setCalendars(await listCalendars())
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se han podido cargar')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    setMsg(null)
    let ok = 0
    try {
      for (const id of chosen) {
        await deleteCalendar(id)
        ok++
      }
      setMsg(`Borrados ${ok}.`)
      setChosen(new Set())
      setArmed(false)
      await load()
    } catch (e) {
      setMsg(
        `${ok > 0 ? `Borrados ${ok}, pero luego falló: ` : ''}${
          e instanceof Error ? e.message : 'error'
        }`,
      )
    } finally {
      setBusy(false)
    }
  }

  const toggle = (id: string) =>
    setChosen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <Card
      title="Calendarios sueltos"
      hint="Los que son tuyos y la app no está usando: restos de pruebas o de configuraciones anteriores. Tu calendario principal y los tres en uso no salen aquí."
    >
      {calendars === null ? (
        <button
          type="button"
          onClick={load}
          disabled={busy}
          className="tap w-full rounded-2xl border border-line py-2.5 text-sm font-semibold text-muted disabled:opacity-40"
        >
          {busy ? 'Cargando…' : 'Ver los que sobran'}
        </button>
      ) : spare.length === 0 ? (
        <p className="text-sm font-semibold text-muted">No sobra ninguno. Todo limpio.</p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            {spare.map((c) => (
              <label
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-elevated px-3 py-2.5"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.summary}</span>
                <input
                  type="checkbox"
                  checked={chosen.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="h-5 w-5 shrink-0 accent-accent"
                />
              </label>
            ))}
          </div>

          {chosen.size > 0 &&
            (armed ? (
              <div className="mt-2.5 rounded-2xl border border-danger-line bg-danger-soft p-3">
                <p className="text-[11px] font-semibold leading-snug text-danger">
                  {chosen.size === 1
                    ? 'Se borrará 1 calendario de tu cuenta de Google con todos sus eventos, para ti y para quien lo tenga compartido.'
                    : `Se borrarán ${chosen.size} calendarios de tu cuenta de Google con todos sus eventos, para ti y para quien los tenga compartidos.`}{' '}
                  No se puede deshacer.
                </p>
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setArmed(false)}
                    className="tap flex-1 rounded-xl border border-line bg-surface py-2 text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={remove}
                    disabled={busy}
                    className="tap flex-1 rounded-xl bg-danger-strong py-2 text-xs font-bold text-danger-strong-fg disabled:opacity-50"
                  >
                    {busy ? 'Borrando…' : chosen.size === 1 ? 'Sí, borrarlo' : 'Sí, borrarlos'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setArmed(true)}
                className="tap mt-2.5 w-full rounded-2xl border border-danger-line py-2.5 text-sm font-semibold text-danger"
              >
                {chosen.size === 1 ? 'Borrar el marcado…' : `Borrar los ${chosen.size} marcados…`}
              </button>
            ))}
        </>
      )}
      {msg && <p className="mt-2 text-[11px] leading-snug text-muted">{msg}</p>}
    </Card>
  )
}
