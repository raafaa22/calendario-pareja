import { useCallback, useEffect, useState } from 'react'
import {
  getProfile,
  isSignedIn,
  onAuthChange,
  signIn,
  signOut,
  trySilentSignIn,
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

  // Al arrancar se intenta renovar el token sin molestar. Solo si falla se
  // muestra la pantalla de login.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Falta configurar VITE_GOOGLE_CLIENT_ID (mira el README).')
      setChecking(false)
      return
    }
    let alive = true
    trySilentSignIn().finally(() => {
      if (alive) setChecking(false)
    })
    return () => {
      alive = false
    }
  }, [])

  const login = useCallback(async () => {
    setError(null)
    setBusy(true)
    try {
      await signIn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido iniciar sesión')
    } finally {
      setBusy(false)
    }
  }, [])

  return { signedIn, profile, checking, busy, error, login, logout: signOut }
}
