import { useCallback, useEffect, useRef, useState } from 'react'
import { OWNERS, type Owner } from '../lib/config'
import { listEvents } from '../lib/gcal'
import { toAppEvent, type AppEvent } from '../lib/model'
import { cacheEvents, readCachedEvents, type Settings } from '../lib/storage'

/**
 * Carga los eventos de los tres calendarios para un rango y los normaliza.
 * Pinta primero lo que haya en cache para que la vista no aparezca vacia, y
 * luego refresca con lo que llegue de la red.
 */
export function useEvents(settings: Settings, from: Date, to: Date, signedIn: boolean) {
  const [events, setEvents] = useState<AppEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)

  // El rango llega como Date nuevas en cada render; se comparan por valor para
  // no entrar en un bucle de recargas.
  const rangeKey = `${from.getTime()}-${to.getTime()}`
  const calKey = OWNERS.map((o) => settings.calendars[o]?.id ?? '').join('|')
  const reqId = useRef(0)

  const load = useCallback(
    async (showSpinner: boolean) => {
      if (!signedIn) return
      const links = OWNERS.map((owner) => ({ owner, link: settings.calendars[owner] })).filter(
        (x): x is { owner: Owner; link: NonNullable<typeof x.link> } => Boolean(x.link),
      )
      if (!links.length) {
        setEvents([])
        return
      }

      const mine = ++reqId.current
      if (showSpinner) setLoading(true)
      setError(null)

      // Cache primero: algo en pantalla de inmediato.
      const cached = links.flatMap(({ owner, link }) =>
        readCachedEvents(link.id).map((raw) => toAppEvent(raw, link.id, owner, link.editable)),
      )
      if (cached.length) setEvents(inRange(cached, from, to))

      const results = await Promise.allSettled(
        links.map(async ({ owner, link }) => {
          const raw = await listEvents(link.id, from, to)
          cacheEvents(link.id, raw)
          return raw.map((r) => toAppEvent(r, link.id, owner, link.editable))
        }),
      )

      if (reqId.current !== mine) return // llegó una petición más nueva

      const ok = results.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value)
      const failed = results.filter((r) => r.status === 'rejected')

      if (failed.length === results.length) {
        setOffline(true)
        setError(
          cached.length
            ? 'Sin conexión: se muestran los últimos eventos guardados.'
            : reason(failed[0]),
        )
      } else {
        setOffline(false)
        setEvents(ok)
        if (failed.length) setError(`Un calendario no ha respondido: ${reason(failed[0])}`)
      }

      if (showSpinner) setLoading(false)
    },
    // rangeKey y calKey resumen from/to/settings.calendars por valor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rangeKey, calKey, signedIn],
  )

  useEffect(() => {
    void load(true)
  }, [load])

  return { events, loading, error, offline, reload: () => load(false) }
}

function inRange(events: AppEvent[], from: Date, to: Date): AppEvent[] {
  return events.filter((e) => e.end >= from && e.start <= to)
}

function reason(r: PromiseSettledResult<unknown>): string {
  if (r.status !== 'rejected') return ''
  return r.reason instanceof Error ? r.reason.message : String(r.reason)
}
