import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings,
} from '../lib/storage'
import { applyTheme, onSystemThemeChange } from '../lib/theme'

/**
 * Ajustes de la cuenta activa. Cuando llega el perfil (o cambia de cuenta) se
 * recargan los de ese correo, y el tema se aplica al <html> en cuanto se sabe.
 */
export function useSettings(email?: string | null) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings(email))
  const [ready, setReady] = useState(false)
  const lastEmail = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (lastEmail.current === email) return
    lastEmail.current = email
    setSettings(loadSettings(email))
    setReady(true)
  }, [email])

  // El tema se escribe en el <html> cada vez que cambia el ajuste.
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

  return { settings: settings ?? DEFAULT_SETTINGS, update, ready }
}
