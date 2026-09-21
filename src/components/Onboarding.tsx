import { useEffect, useState } from 'react'
import type { Profile } from '../lib/auth'
import { detectPartnerEmail, ourCalendarCandidates } from '../lib/calendarGuess'
import { OWNER_STYLES } from '../lib/config'
import {
  addCalendarToList,
  createCalendar,
  listCalendars,
  shareCalendar,
  type GCalCalendar,
} from '../lib/gcal'
import type { CalendarLink, Settings } from '../lib/storage'

/**
 * Primera vez. Lo monta todo a partir de dos datos: la cuenta con la que se ha
 * entrado y el correo de la pareja.
 *
 * La clave es que en Google el ID del calendario principal de una cuenta ES su
 * correo. Asi que no hace falta que nadie busque nada en un desplegable: el
 * carril propio es el calendario de quien ha entrado, y el de la pareja es su
 * correo. Lo unico que no se puede deducir de un correo es el calendario
 * conjunto, y de eso se encarga la app: lo busca entre los que la pareja ya
 * haya compartido y, si no hay ninguno, lo crea.
 *
 * Convenio de carriles: `mine` es siempre el de quien ha entrado y `hers` el de
 * la pareja, con `me` en 'mine'. Cada movil guarda su propio reparto, asi que
 * los dos ven "Yo" en su calendario. Se puede cambiar luego en los ajustes.
 */

interface Props {
  profile: Profile | null
  onChange: (patch: Partial<Settings>) => void
  /** Para ir a la pantalla de siempre y hacerlo a mano. */
  onManual: () => void
  onSignOut: () => void
}

export default function Onboarding({ profile, onChange, onManual, onSignOut }: Props) {
  const [calendars, setCalendars] = useState<GCalCalendar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [partnerEmail, setPartnerEmail] = useState('')
  /** true si el correo lo ha encontrado la app, no lo ha escrito el usuario. */
  const [partnerDetected, setPartnerDetected] = useState(false)
  const [oursChoice, setOursChoice] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [mutualEdit, setMutualEdit] = useState(true)
  /**
   * Resultado a medio aplicar: si hubo algo que contar, los ajustes se guardan
   * cuando lo lee, no antes. Si se guardaran ya, la app pasaria al calendario
   * en el mismo render y el aviso no se veria nunca.
   */
  const [pending, setPending] = useState<{ patch: Partial<Settings>; warnings: string[] } | null>(
    null,
  )

  const primary = calendars.find((c) => c.primary)
  const myEmail = profile?.email

  /**
   * Candidatos a calendario conjunto: los que no son el principal de nadie.
   * Si la pareja ya lo creo y compartio, saldra aqui y se reutiliza en vez de
   * crear un segundo, que es el error que dejaria dos calendarios "Nosotros"
   * distintos sin que nadie se diera cuenta.
   *
   * Se descartan los que tienen pinta de calendario principal de una persona:
   * si tu pareja te compartio el suyo con permiso de edicion, apareceria aqui
   * y no es el conjunto.
   */
  const oursCandidates = ourCalendarCandidates(calendars)

  useEffect(() => {
    let alive = true
    listCalendars()
      .then((list) => {
        if (!alive) return
        setCalendars(list)

        // Si hay exactamente uno, se preselecciona: es casi seguro el bueno.
        const candidates = ourCalendarCandidates(list)
        if (candidates.length === 1) setOursChoice(candidates[0].id)

        // Y si ya te compartio el suyo, su correo esta a la vista: no hace
        // falta que lo escribas.
        const found = detectPartnerEmail(list, myEmail)
        if (found) {
          setPartnerEmail(found)
          setPartnerDetected(true)
        }
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'No se han podido leer tus calendarios'),
      )
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(partnerEmail.trim())
  const partner = partnerEmail.trim().toLowerCase()
  const samePerson = Boolean(profile?.email && partner === profile.email.toLowerCase())

  async function handleStart() {
    if (!primary || !emailOk || samePerson) return

    setBusy(true)
    setError(null)
    const notes: string[] = []

    try {
      // --- 1. El calendario conjunto: el elegido, o uno nuevo ---
      let ours: GCalCalendar
      if (oursChoice) {
        ours = calendars.find((c) => c.id === oursChoice)!
      } else {
        ours = { ...(await createCalendar('Nosotros')), accessRole: 'owner' }
      }

      // --- 2. Darle acceso a la pareja ---
      // Solo tiene sentido si el calendario es nuestro; si nos lo compartieron,
      // ya lo tiene quien lo creo.
      if (ours.accessRole === 'owner') {
        try {
          await shareCalendar(ours.id, partner, 'writer')
        } catch {
          notes.push(`No se ha podido compartir «${ours.summary}». Hazlo luego desde los ajustes.`)
        }
      }

      try {
        await shareCalendar(primary.id, partner, 'writer')
      } catch {
        notes.push(
          'No se ha podido compartir tu calendario. Hazlo luego desde los ajustes, o no verá tus eventos.',
        )
      }

      // --- 3. El de la pareja: su correo ES su calendario ---
      let partnerCal: CalendarLink = {
        id: partner,
        summary: partner,
        label: '',
        editable: false,
      }
      try {
        const added = await addCalendarToList(partner)
        partnerCal = {
          id: added.id,
          summary: added.summary,
          label: '',
          editable: added.accessRole === 'owner' || added.accessRole === 'writer',
        }
      } catch {
        // Lo normal la primera vez: todavia no te ha compartido el suyo.
        notes.push(
          `${partner} aún no ha compartido su calendario contigo. Cuando entre en la app y ponga tu correo, sus eventos aparecerán solos.`,
        )
      }

      // --- 4. Guardar ---
      const patch: Partial<Settings> = {
        me: 'mine',
        calendars: {
          mine: { id: primary.id, summary: primary.summary, label: '', editable: true },
          hers: partnerCal,
          ours: {
            id: ours.id,
            summary: ours.summary,
            label: '',
            editable: ours.accessRole === 'owner' || ours.accessRole === 'writer',
          },
        },
      }

      // Sin nada que contar, directo al calendario: en cuanto se guardan los
      // tres calendarios la app deja de mostrar esta pantalla.
      if (notes.length) setPending({ patch, warnings: notes })
      else onChange(patch)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido terminar la configuración')
    } finally {
      setBusy(false)
    }
  }

  // Ya está montado y solo quedan avisos que leer.
  if (pending) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-lg">
          <h1 className="text-xl font-extrabold">Listo</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Ya puedes usar el calendario. Un par de cosas que conviene que sepas:
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {pending.warnings.map((w) => (
              <li
                key={w}
                className="rounded-2xl border border-line bg-warn-soft px-3 py-2.5 text-xs leading-snug text-warn"
              >
                {w}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onChange(pending.patch)}
            className="tap mt-5 w-full rounded-2xl bg-accent py-3 text-sm font-bold text-accent-fg"
          >
            Entendido, al calendario
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-lg">
        <h1 className="text-xl font-extrabold">
          {profile?.givenName ? `Hola, ${profile.givenName}` : 'Vamos a montarlo'}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Solo hace falta el correo de tu pareja. El resto lo monta la app.
        </p>

        {loading ? (
          <p className="mt-6 text-sm text-subtle">Leyendo tus calendarios…</p>
        ) : (
          <>
            {/* Tu calendario: ya se sabe, es el de la cuenta con la que has entrado. */}
            <div className="mt-5 rounded-3xl border border-line bg-surface p-3.5 shadow-card">
              <div className="mb-2 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${OWNER_STYLES.mine.dot}`} />
                <span className="text-xs font-extrabold uppercase tracking-wide">Tu calendario</span>
                <span className="ml-auto rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">
                  ya está
                </span>
              </div>
              <div className="truncate text-sm font-bold">{primary?.summary ?? '—'}</div>
              <div className="truncate text-[11px] text-subtle">{profile?.email}</div>
            </div>

            {/* El de ella: su correo es su calendario. */}
            <div className="mt-3 rounded-3xl border border-line bg-surface p-3.5 shadow-card">
              <div className="mb-2 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${OWNER_STYLES.hers.dot}`} />
                <span className="text-xs font-extrabold uppercase tracking-wide">
                  El de tu pareja
                </span>
                {partnerDetected && (
                  <span className="ml-auto rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">
                    detectado
                  </span>
                )}
              </div>
              <input
                type="email"
                inputMode="email"
                autoCapitalize="off"
                spellCheck={false}
                value={partnerEmail}
                onChange={(e) => {
                  setPartnerEmail(e.target.value)
                  setPartnerDetected(false)
                }}
                placeholder="su-correo@gmail.com"
                className="w-full rounded-2xl border border-line bg-elevated px-3.5 py-2.5 text-sm font-semibold outline-none placeholder:font-normal placeholder:text-subtle focus:border-accent-line"
              />
              {samePerson ? (
                <p className="mt-1.5 text-[11px] text-danger">Ese es tu propio correo.</p>
              ) : (
                partnerDetected && (
                  <p className="mt-1.5 text-[11px] leading-snug text-subtle">
                    Sale de un calendario que ya te ha compartido. Cámbialo si no es el suyo.
                  </p>
                )
              )}
            </div>

            {/* Nosotros: lo unico que no se deduce de un correo. */}
            <div className="mt-3 rounded-3xl border border-line bg-surface p-3.5 shadow-card">
              <div className="mb-2 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${OWNER_STYLES.ours.dot}`} />
                <span className="text-xs font-extrabold uppercase tracking-wide">
                  El de los dos
                </span>
              </div>
              {oursCandidates.length > 0 ? (
                <select
                  value={oursChoice}
                  onChange={(e) => setOursChoice(e.target.value)}
                  className="w-full appearance-none rounded-2xl border border-line bg-elevated px-3.5 py-2.5 text-sm outline-none focus:border-accent-line"
                >
                  <option value="">Crear uno nuevo llamado «Nosotros»</option>
                  {oursCandidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      Usar «{c.summary}»
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm font-semibold">Se creará «Nosotros»</p>
              )}
              <p className="mt-1.5 text-[11px] leading-snug text-subtle">
                {oursCandidates.length > 0
                  ? 'Si tu pareja ya lo creó y te lo compartió, elígelo de la lista en vez de crear otro.'
                  : 'Si tu pareja ya lo creó, pídele que te lo comparta antes de seguir; si no, tendréis dos.'}
              </p>
            </div>

            <label className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 shadow-card">
              <span className="min-w-0">
                <span className="block text-sm font-bold">Que pueda editar tu calendario</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-subtle">
                  Con esto podéis apuntaros cosas el uno al otro. Sin esto, solo ve tus eventos.
                  El calendario de los dos siempre es editable.
                </span>
              </span>
              <input
                type="checkbox"
                checked={mutualEdit}
                onChange={(e) => setMutualEdit(e.target.checked)}
                className="h-5 w-5 shrink-0 accent-accent"
              />
            </label>

            {/* Que va a hacer exactamente, antes de tocar nada. */}
            <div className="mt-4 rounded-2xl border border-line bg-elevated p-3">
              <div className="text-[11px] font-bold text-muted">Al empezar, la app va a:</div>
              <ul className="mt-1.5 flex flex-col gap-1 text-[11px] leading-snug text-subtle">
                <li>• Usar tu calendario como el tuyo</li>
                <li>• Usar {partner || 'el correo de tu pareja'} como el suyo</li>
                <li>• {oursChoice ? 'Usar el calendario conjunto elegido' : 'Crear «Nosotros»'}</li>
                <li>
                  • Compartir tu calendario con {partner || 'tu pareja'}
                  {mutualEdit ? ' con permiso de edición' : ', solo para verlo'}, y el de los dos
                  con permiso de edición
                </li>
              </ul>
            </div>

            {error && (
              <p className="mt-4 rounded-2xl border border-danger-line bg-danger-soft px-3 py-2 text-xs text-danger">
                {error}
              </p>
            )}

            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleStart}
                disabled={!emailOk || samePerson || busy || !primary}
                className="tap rounded-2xl bg-accent py-3 text-sm font-bold text-accent-fg disabled:opacity-40"
              >
                {busy ? 'Montándolo…' : 'Empezar'}
              </button>
              <button
                type="button"
                onClick={onManual}
                className="tap rounded-2xl border border-line py-2.5 text-sm font-semibold text-muted"
              >
                Prefiero elegir los calendarios a mano
              </button>
              <button
                type="button"
                onClick={onSignOut}
                className="tap py-1 text-xs text-subtle underline decoration-line"
              >
                Entrar con otra cuenta
              </button>
            </div>
          </>
        )}

        <p className="mt-5 text-[11px] leading-snug text-subtle">
          Todo esto se puede cambiar después en <strong>Ajustes → Los calendarios</strong>: poner
          otros calendarios, crear nuevos o cambiarles el nombre.
        </p>
      </div>
    </div>
  )
}

