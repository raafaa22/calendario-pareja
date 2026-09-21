import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings,
} from '../lib/storage'

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setSettings(loadSettings())
    setReady(true)
  }, [])

  const update = useCallback((patch: Partial<Settings> | ((s: Settings) => Settings)) => {
    setSettings((prev) => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  return { settings, update, ready }
}
