import { useEffect, useState } from 'react'
import { OWNERS, OWNER_STYLES, type Owner } from '../lib/config'
import { createCalendar, listCalendars, shareCalendar, type GCalCalendar } from '../lib/gcal'
import { clearEventCache, type Settings } from '../lib/storage'

/** Nombres que se proponen al crear los calendarios desde cero. */
const SUGGESTED: Record<Owner, string> = {
  mine: 'Mi agenda',
  hers: 'Su agenda',
  ours: 'Nosotros',
}

const HINTS: Record<Owner, string> = {
  mine: 'Tu horario de trabajo, gym, barbero…',
  hers: 'Sus clases, prácticas, médico…',
  ours: 'Cenas, planes, aniversarios',
}

interface Props {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  /** Al cerrar desde los ajustes; ausente durante la configuracion inicial. */
  onDone?: () => void
  onSignOut: () => void
}

export default function SetupCalendars({ settings, onChange, onDone, onSignOut }: Props) {
  const [calendars, setCalendars] = useState<GCalCalendar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyOwner, setBusyOwner] = useState<Owner | null>(null)
  const [shareTarget, setShareTarget] = useState<Owner | null>(null)
  const [shareEmail, setShareEmail] = useState('')
  const [shareRole, setShareRole] = useState<'reader' | 'writer'>('writer')
  const [shareMsg, setShareMsg] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      setCalendars(await listCalendars())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se han podido cargar los calendarios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const assign = (owner: Owner, cal: GCalCalendar | null) => {
    // Cambiar de calendario invalida la cache: los eventos guardados son de otro.
    clearEventCache()
    onChange({
      calendars: {
        ...settings.calendars,
        [owner]: cal
          ? {
              id: cal.id,
              summary: cal.summary,
              editable: cal.accessRole === 'owner' || cal.accessRole === 'writer',
            }
          : undefined,
      },
    })
  }

  async function handleCreate(owner: Owner) {
    setBusyOwner(owner)
    setError(null)
    try {
      const cal = await createCalendar(SUGGESTED[owner])
      // El calendario recien creado no aparece en la lista cacheada.
      setCalendars((prev) => [...prev, { ...cal, accessRole: 'owner' }])
      assign(owner, { ...cal, accessRole: 'owner' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido crear el calendario')
    } finally {
      setBusyOwner(null)
    }
  }

  async function handleShare() {
    const owner = shareTarget
    const link = owner ? settings.calendars[owner] : undefined
    if (!owner || !link) return

    setBusyOwner(owner)
    setShareMsg(null)
    try {
      await shareCalendar(link.id, shareEmail.trim(), shareRole)
      setShareMsg(`Compartido con ${shareEmail.trim()}. Le llegará un correo de Google.`)
      setShareEmail('')
    } catch (e) {
      setShareMsg(e instanceof Error ? e.message : 'No se ha podido compartir')
    } finally {
      setBusyOwner(null)
    }
  }

  const done = OWNERS.every((o) => settings.calendars[o])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
      <div className="mx-auto max-w-lg">
        <h1 className="text-xl font-bold">Conectar los calendarios</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-subtle">
          Elige qué calendario de Google corresponde a cada uno. Si aún no
          existen, la app los crea por ti.
        </p>

        {loading ? (
          <p className="mt-6 text-sm text-subtle">Cargando tus calendarios…</p>
        ) : (
          <div className="mt-5 flex flex-col gap-4">
            {OWNERS.map((owner) => {
              const style = OWNER_STYLES[owner]
              const current = settings.calendars[owner]

              return (
                <div
                  key={owner}
                  className="rounded-2xl border border-line bg-surface p-3.5"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                    <span className="text-sm font-semibold">{style.label}</span>
                    <span className="ml-auto text-[11px] text-subtle">{HINTS[owner]}</span>
                  </div>

                  <select
                    value={current?.id ?? ''}
                    onChange={(e) =>
                      assign(owner, calendars.find((c) => c.id === e.target.value) ?? null)
                    }
                    className="w-full appearance-none rounded-xl border border-line bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent-line"
                  >
                    <option value="" className="bg-surface">
                      — Sin asignar —
                    </option>
                    {calendars.map((c) => (
                      <option key={c.id} value={c.id} className="bg-surface">
                        {c.summary}
                        {c.primary ? ' (principal)' : ''}
                        {c.accessRole === 'reader' ? ' · solo lectura' : ''}
                      </option>
                    ))}
                  </select>

                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleCreate(owner)}
                      disabled={busyOwner === owner}
                      className="tap text-xs text-accent underline decoration-accent-line disabled:opacity-50"
                    >
                      Crear «{SUGGESTED[owner]}»
                    </button>

                    {current && (
                      <button
                        type="button"
                        onClick={() => {
                          setShareTarget(shareTarget === owner ? null : owner)
                          setShareMsg(null)
                        }}
                        className="tap text-xs text-subtle underline decoration-line"
                      >
                        Compartir…
                      </button>
                    )}

                    {current && !current.editable && (
                      <span className="text-xs text-warn">solo lectura</span>
                    )}
                  </div>

                  {shareTarget === owner && current && (
                    <div className="mt-3 rounded-xl border border-line bg-elevated p-3">
                      <p className="mb-2 text-[11px] leading-snug text-subtle">
                        Da acceso a «{current.summary}» a otra cuenta de Google. Google le
                        enviará una invitación por correo.
                      </p>
                      <input
                        type="email"
                        inputMode="email"
                        value={shareEmail}
                        onChange={(e) => setShareEmail(e.target.value)}
                        placeholder="correo@gmail.com"
                        className="w-full rounded-lg border border-line bg-elevated px-2.5 py-2 text-sm outline-none placeholder:text-subtle focus:border-accent-line"
                      />
                      <div className="mt-2 flex gap-2">
                        {(
                          [
                            ['writer', 'Puede editar'],
                            ['reader', 'Solo ver'],
                          ] as const
                        ).map(([role, label]) => (
                          <button
                            key={role}
                            type="button"
                            onClick={() => setShareRole(role)}
                            className={`tap flex-1 rounded-lg border py-1.5 text-xs transition ${
                              shareRole === role
                                ? 'border-accent-line bg-accent-soft text-accent'
                                : 'border-line text-subtle'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={handleShare}
                        disabled={!shareEmail.includes('@') || busyOwner === owner}
                        className="tap mt-2 w-full rounded-lg bg-accent py-2 text-xs font-semibold text-accent-fg disabled:opacity-40"
                      >
                        {busyOwner === owner ? 'Compartiendo…' : 'Compartir'}
                      </button>
                      {shareMsg && (
                        <p className="mt-2 text-[11px] leading-snug text-muted">{shareMsg}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-danger-line bg-danger-soft px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={refresh}
            className="tap rounded-xl border border-line py-2.5 text-sm text-muted"
          >
            Recargar la lista
          </button>

          {onDone ? (
            <button
              type="button"
              onClick={onDone}
              className="tap rounded-xl bg-accent py-3 text-sm font-semibold text-accent-fg"
            >
              Volver al calendario
            </button>
          ) : (
            <button
              type="button"
              disabled={!done}
              onClick={() => window.location.reload()}
              className="tap rounded-xl bg-accent py-3 text-sm font-semibold text-accent-fg disabled:opacity-35"
            >
              {done ? 'Empezar' : 'Asigna los tres calendarios'}
            </button>
          )}

          <button
            type="button"
            onClick={onSignOut}
            className="tap py-1 text-xs text-subtle underline decoration-line"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
