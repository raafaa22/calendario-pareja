import { useEffect, useState } from 'react'
import { OWNERS, OWNER_STYLES, type Owner } from '../lib/config'
import {
  addCalendarToList,
  createCalendar,
  deleteCalendar,
  GCalError,
  listCalendars,
  shareCalendar,
  type GCalCalendar,
} from '../lib/gcal'
import { ownerLabels } from '../lib/labels'
import { isPerson, partnerOf, type PersonOwner } from '../lib/owners'
import { clearEventCache, type Settings } from '../lib/storage'

/**
 * Nombres que se proponen al crear los calendarios desde cero. Tambien van
 * relativos a quien ha entrado: en su movil, el boton del carril de el no
 * puede decir "Mi agenda".
 */
function suggestedNames(me: PersonOwner): Record<Owner, string> {
  return {
    [me]: 'Mi agenda',
    [partnerOf(me)]: 'Su agenda',
    ours: 'Nosotros',
  } as Record<Owner, string>
}

interface Props {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  /** Al cerrar desde los ajustes; ausente durante la configuracion inicial. */
  onDone?: () => void
  onSignOut: () => void
}

export default function SetupCalendars({ settings, onChange, onDone, onSignOut }: Props) {
  const labels = ownerLabels(settings)
  const suggested = suggestedNames(settings.me)
  const [calendars, setCalendars] = useState<GCalCalendar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyOwner, setBusyOwner] = useState<Owner | null>(null)
  const [panel, setPanel] = useState<{ owner: Owner; kind: 'share' | 'remove' } | null>(null)
  const [shareEmail, setShareEmail] = useState('')
  const [shareRole, setShareRole] = useState<'reader' | 'writer'>('writer')
  const [msg, setMsg] = useState<string | null>(null)
  const [byIdOwner, setByIdOwner] = useState<Owner | null>(null)
  const [byIdValue, setByIdValue] = useState('')

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

  const patchCalendar = (owner: Owner, link: Settings['calendars'][Owner] | undefined) => {
    // Cambiar de calendario invalida la cache: los eventos guardados son de otro.
    clearEventCache()
    onChange({ calendars: { ...settings.calendars, [owner]: link } })
  }

  const assign = (owner: Owner, cal: GCalCalendar | null) =>
    patchCalendar(
      owner,
      cal
        ? {
            id: cal.id,
            summary: cal.summary,
            // El nombre visible arranca con el de Google y luego se puede cambiar.
            label: settings.calendars[owner]?.label || cal.summary,
            editable: cal.accessRole === 'owner' || cal.accessRole === 'writer',
          }
        : undefined,
    )

  const rename = (owner: Owner, label: string) => {
    const current = settings.calendars[owner]
    if (current) onChange({ calendars: { ...settings.calendars, [owner]: { ...current, label } } })
  }

  async function handleCreate(owner: Owner) {
    setBusyOwner(owner)
    setError(null)
    try {
      const cal = await createCalendar(suggested[owner])
      // El calendario recien creado no aparece en la lista cacheada.
      const withRole: GCalCalendar = { ...cal, accessRole: 'owner' }
      setCalendars((prev) => [...prev, withRole])
      assign(owner, withRole)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido crear el calendario')
    } finally {
      setBusyOwner(null)
    }
  }

  async function handleShare() {
    const owner = panel?.owner
    const link = owner ? settings.calendars[owner] : undefined
    if (!owner || !link) return

    setBusyOwner(owner)
    setMsg(null)
    try {
      await shareCalendar(link.id, shareEmail.trim(), shareRole)
      setMsg(`Compartido con ${shareEmail.trim()}. Le llegará un correo de Google.`)
      setShareEmail('')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se ha podido compartir')
    } finally {
      setBusyOwner(null)
    }
  }

  /**
   * Anade un calendario por su ID. Es la salida para el caso de "me lo han
   * compartido pero no me sale en la lista": compartir da permiso, pero Google
   * no siempre lo mete en la lista del otro hasta que acepta la invitacion.
   */
  async function handleAddById(owner: Owner) {
    const id = byIdValue.trim()
    if (!id) return

    setBusyOwner(owner)
    setMsg(null)
    try {
      const cal = await addCalendarToList(id)
      setCalendars((prev) => [...prev.filter((c) => c.id !== cal.id), cal])
      assign(owner, cal)
      setByIdOwner(null)
      setByIdValue('')
      setMsg(`«${cal.summary}» añadido.`)
    } catch (e) {
      if (e instanceof GCalError && (e.status === 404 || e.status === 403)) {
        setMsg(
          'Ese calendario no está compartido contigo, o el ID no es correcto. Pídele que lo comparta con tu correo primero.',
        )
      } else {
        setMsg(e instanceof Error ? e.message : 'No se ha podido añadir')
      }
    } finally {
      setBusyOwner(null)
    }
  }

  /** Lo quita de la app, sin tocar nada en Google. */
  function handleUnassign(owner: Owner) {
    patchCalendar(owner, undefined)
    setPanel(null)
    setMsg('Quitado de la app. El calendario sigue intacto en Google.')
  }

  /** Borra el calendario en Google. Se lleva por delante todos sus eventos. */
  async function handleDeleteInGoogle(owner: Owner) {
    const link = settings.calendars[owner]
    if (!link) return
    setBusyOwner(owner)
    setMsg(null)
    try {
      await deleteCalendar(link.id)
      patchCalendar(owner, undefined)
      setCalendars((prev) => prev.filter((c) => c.id !== link.id))
      setPanel(null)
      setMsg(`«${link.summary}» se ha borrado de Google.`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se ha podido borrar')
    } finally {
      setBusyOwner(null)
    }
  }

  const done = OWNERS.every((o) => settings.calendars[o])

  return (
    <div className="mx-auto max-w-lg px-4 py-5">
      <h1 className="text-xl font-extrabold">Los calendarios</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        Elige qué calendario de Google corresponde a cada uno, y con qué nombre
        quieres verlo en la app. Marca también cuál de los dos eres tú: los dos
        veis los mismos calendarios, pero cada uno desde su lado.
      </p>

      {loading ? (
        <p className="mt-6 text-sm text-subtle">Cargando tus calendarios…</p>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {OWNERS.map((owner) => {
            const style = OWNER_STYLES[owner]
            const current = settings.calendars[owner]
            const open = panel?.owner === owner

            return (
              <div
                key={owner}
                className="rounded-3xl border border-line bg-surface p-3.5 shadow-card"
              >
                <div className="mb-2.5 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} />
                  <span className={`text-xs font-extrabold uppercase tracking-wide ${style.text}`}>
                    {labels[owner]}
                  </span>
                  {/* Cual de los dos carriles personales es quien esta usando
                      la app. Sin esto, en su movil saldria "Yo" en tu
                      calendario. */}
                  {isPerson(owner) && (
                    <button
                      type="button"
                      onClick={() => onChange({ me: owner as PersonOwner })}
                      className={`tap ml-auto shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold transition ${
                        settings.me === owner
                          ? 'border-accent bg-accent text-accent-fg'
                          : 'border-line text-subtle'
                      }`}
                    >
                      {settings.me === owner ? 'Este soy yo' : '¿Este soy yo?'}
                    </button>
                  )}
                </div>

                {/* Nombre con el que se ve en la app. */}
                {current && (
                  <input
                    value={current.label}
                    onChange={(e) => rename(owner, e.target.value)}
                    placeholder={current.summary}
                    maxLength={24}
                    className="mb-2 w-full rounded-2xl border border-line bg-elevated px-3.5 py-2.5 text-sm font-bold outline-none placeholder:font-normal placeholder:text-subtle focus:border-accent-line"
                  />
                )}

                <select
                  value={current?.id ?? ''}
                  onChange={(e) =>
                    assign(owner, calendars.find((c) => c.id === e.target.value) ?? null)
                  }
                  className="w-full appearance-none rounded-2xl border border-line bg-elevated px-3.5 py-2.5 text-sm outline-none focus:border-accent-line"
                >
                  <option value="">— Sin asignar —</option>
                  {calendars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.summary}
                      {c.primary ? ' (principal)' : ''}
                      {c.accessRole === 'reader' ? ' · solo lectura' : ''}
                    </option>
                  ))}
                </select>

                <div className="mt-2.5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleCreate(owner)}
                    disabled={busyOwner === owner}
                    className="tap text-xs font-semibold text-accent underline decoration-accent-line disabled:opacity-50"
                  >
                    Crear «{suggested[owner]}»
                  </button>

                  {current && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setPanel(open && panel?.kind === 'share' ? null : { owner, kind: 'share' })
                          setMsg(null)
                        }}
                        className="tap text-xs text-muted underline decoration-line"
                      >
                        Compartir…
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPanel(
                            open && panel?.kind === 'remove' ? null : { owner, kind: 'remove' },
                          )
                          setMsg(null)
                        }}
                        className="tap text-xs text-danger underline decoration-danger-line"
                      >
                        Quitar…
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setByIdOwner(byIdOwner === owner ? null : owner)
                      setByIdValue('')
                      setMsg(null)
                    }}
                    className="tap text-xs text-muted underline decoration-line"
                  >
                    No me sale en la lista…
                  </button>

                  {current && !current.editable && (
                    <span className="text-xs text-warn">solo lectura</span>
                  )}
                </div>

                {byIdOwner === owner && (
                  <div className="mt-3 rounded-2xl border border-line bg-elevated p-3">
                    <p className="mb-2 text-[11px] leading-snug text-subtle">
                      Si te lo han compartido pero no aparece arriba, pega aquí su ID. Suele ser
                      un correo, o algo terminado en <code>@group.calendar.google.com</code>. Lo
                      encuentra tu pareja en la app, en este mismo calendario.
                    </p>
                    <input
                      value={byIdValue}
                      onChange={(e) => setByIdValue(e.target.value)}
                      placeholder="correo@gmail.com"
                      autoCapitalize="off"
                      spellCheck={false}
                      className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-subtle focus:border-accent-line"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddById(owner)}
                      disabled={!byIdValue.trim() || busyOwner === owner}
                      className="tap mt-2 w-full rounded-xl bg-accent py-2 text-xs font-bold text-accent-fg disabled:opacity-40"
                    >
                      {busyOwner === owner ? 'Añadiendo…' : 'Añadir a mi lista'}
                    </button>
                  </div>
                )}

                {open && panel?.kind === 'share' && current && (
                  <div className="mt-3 rounded-2xl border border-line bg-elevated p-3">
                    <p className="mb-2 text-[11px] leading-snug text-subtle">
                      Da acceso a «{current.summary}» a otra cuenta de Google. Le enviará una
                      invitación por correo.
                    </p>
                    <input
                      type="email"
                      inputMode="email"
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                      placeholder="correo@gmail.com"
                      className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-subtle focus:border-accent-line"
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
                          className={`tap flex-1 rounded-xl border py-2 text-xs font-semibold transition ${
                            shareRole === role
                              ? 'border-accent bg-accent text-accent-fg'
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
                      className="tap mt-2 w-full rounded-xl bg-accent py-2 text-xs font-bold text-accent-fg disabled:opacity-40"
                    >
                      {busyOwner === owner ? 'Compartiendo…' : 'Compartir'}
                    </button>
                  </div>
                )}

                {open && panel?.kind === 'remove' && current && (
                  <div className="mt-3 rounded-2xl border border-line bg-elevated p-3">
                    <button
                      type="button"
                      onClick={() => handleUnassign(owner)}
                      className="tap w-full rounded-xl border border-line bg-surface py-2.5 text-xs font-semibold"
                    >
                      Quitarlo de la app
                    </button>
                    <p className="mt-1.5 text-[11px] leading-snug text-subtle">
                      Deja el hueco libre aquí. En Google no cambia nada y lo puedes volver a
                      asignar cuando quieras.
                    </p>

                    <DangerousDelete
                      name={current.summary}
                      busy={busyOwner === owner}
                      onConfirm={() => handleDeleteInGoogle(owner)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-2xl border border-danger-line bg-danger-soft px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}
      {msg && <p className="mt-3 text-[11px] leading-snug text-muted">{msg}</p>}

      <div className="mt-6 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={refresh}
          className="tap rounded-2xl border border-line py-2.5 text-sm font-semibold text-muted"
        >
          Recargar la lista
        </button>

        {onDone ? (
          <button
            type="button"
            onClick={onDone}
            className="tap rounded-2xl bg-accent py-3 text-sm font-bold text-accent-fg"
          >
            Volver al calendario
          </button>
        ) : (
          <button
            type="button"
            disabled={!done}
            onClick={() => window.location.reload()}
            className="tap rounded-2xl bg-accent py-3 text-sm font-bold text-accent-fg disabled:opacity-35"
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
  )
}

/**
 * Borrar el calendario en Google se lleva por delante todos sus eventos y no
 * tiene vuelta atras, asi que va detras de dos toques y dice exactamente que
 * se pierde.
 */
function DangerousDelete({
  name,
  busy,
  onConfirm,
}: {
  name: string
  busy: boolean
  onConfirm: () => void
}) {
  const [armed, setArmed] = useState(false)

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="tap mt-3 w-full rounded-xl border border-danger-line py-2.5 text-xs font-semibold text-danger"
      >
        Borrarlo también de Google…
      </button>
    )
  }

  return (
    <div className="mt-3 rounded-xl border border-danger-line bg-danger-soft p-3">
      <p className="text-[11px] font-semibold leading-snug text-danger">
        Se borrará «{name}» de tu cuenta de Google con todos sus eventos, para ti y para quien lo
        tenga compartido. No se puede deshacer.
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
          onClick={onConfirm}
          disabled={busy}
          className="tap flex-1 rounded-xl bg-danger-strong py-2 text-xs font-bold text-danger-strong-fg disabled:opacity-50"
        >
          {busy ? 'Borrando…' : 'Sí, borrarlo'}
        </button>
      </div>
    </div>
  )
}
