import { useCallback, useEffect, useRef, useState } from 'react'
import { loadSettings, saveSettings, type Settings } from '../lib/storage'
import { applyTheme, onSystemThemeChange } from '../lib/theme'

/**
 * Ajustes de la cuenta activa. Cuando llega el perfil (o cambia de cuenta) se
 * recargan los de ese correo, y el tema se aplica al <html> en cuanto se sabe.
 *
 * No hay ningun flag de "ya estoy listo" a proposito: `loadSettings` es
 * sincrono y se llama en el inicializador del useState, asi que en el primer
 * render ya hay ajustes. Antes habia uno, y era un agujero: arrancaba en false
 * y solo pasaba a true cuando cambiaba el correo, asi que sin perfil guardado
 * —la primera visita— nunca cambiaba y la app se quedaba en el spinner.
 */
export function useSettings(email?: string | null) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings(email))

  // Arranca con el correo del primer render: si no cambia, no hay que recargar.
  const lastEmail = useRef(email)

  useEffect(() => {
    if (lastEmail.current === email) return
    lastEmail.current = email
    setSettings(loadSettings(email))
  }, [email])

  // El tema se escribe en el <html> cada vez que cambian los ajustes.
  useEffect(() => {
    applyTheme(settings)
  }, [settings])

  // En modo automatico hay que seguir al sistema si el usuario lo cambia.
  useEffect(() => {
    if (settings.theme !== 'system') return
    return onSystemThemeChange(() => applyTheme(settings))
  }, [settings])

  const update = useCallback(
    (patch: Partial<Settings> | ((s: Settings) => Settings)) => {
      setSettings((prev) => {
        const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
        saveSettings(next, email)
        return next
      })
    },
    [email],
  )

  return { settings, update }
}
