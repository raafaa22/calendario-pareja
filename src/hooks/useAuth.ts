import { useCallback, useEffect, useState } from 'react'
import { isSignedIn, onAuthChange, signIn, signOut, trySilentSignIn } from '../lib/auth'
import { GOOGLE_CLIENT_ID } from '../lib/config'

export function useAuth() {
  const [signedIn, setSignedIn] = useState(isSignedIn)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => onAuthChange(setSignedIn), [])

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
    try {
      await signIn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido iniciar sesión')
    }
  }, [])

  return { signedIn, checking, error, login, logout: signOut }
}
