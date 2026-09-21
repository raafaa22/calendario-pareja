import { useCallback, useEffect, useState } from 'react'
import {
  getProfile,
  isSignedIn,
  onAuthChange,
  restoreSession,
  signIn,
  signOut,
  type Profile,
} from '../lib/auth'
import { GOOGLE_CLIENT_ID } from '../lib/config'

export function useAuth() {
  const [signedIn, setSignedIn] = useState(isSignedIn)
  const [profile, setProfile] = useState<Profile | null>(getProfile)
  const [checking, setChecking] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(
    () =>
      onAuthChange(() => {
        setSignedIn(isSignedIn())
        setProfile(getProfile())
      }),
    [],
  )

  // Al arrancar solo se mira si hay sesion guardada. Es inmediato: no se
  // consulta a Google, porque su cliente de tokens abre una emergente y una
  // emergente sin toque del usuario la bloquea el navegador (y tarda varios
  // segundos en rendirse, que es lo que dejaba la app en la pantalla de carga).
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Falta configurar VITE_GOOGLE_CLIENT_ID (mira el README).')
    } else {
      restoreSession()
    }
    setChecking(false)
  }, [])

  const login = useCallback(async () => {
    setError(null)
    setBusy(true)
    try {
      await signIn()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }, [])

  return { signedIn, profile, checking, busy, error, login, logout: signOut }
}

/**
 * Los errores de Google Identity Services vienen en ingles y con nombres
 * internos. Se traducen los que se ven de verdad, y el resto pasa tal cual.
 */
function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  const key = raw.toLowerCase()

  if (key.includes('popup') && (key.includes('open') || key.includes('block'))) {
    return 'El navegador ha bloqueado la ventana de Google. Permite las ventanas emergentes para este sitio y vuelve a intentarlo.'
  }
  if (key.includes('popup_closed') || key.includes('closed')) {
    return 'Has cerrado la ventana de Google antes de entrar.'
  }
  if (key.includes('access_denied') || key.includes('denied')) {
    return 'No se han concedido los permisos, así que la app no puede ver los calendarios.'
  }
  if (key.includes('idpiframe') || key.includes('gsi') || key.includes('network')) {
    return 'No se ha podido contactar con Google. Comprueba la conexión y vuelve a intentarlo.'
  }
  return raw || 'No se ha podido iniciar sesión'
}
