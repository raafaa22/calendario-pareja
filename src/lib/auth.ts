import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from './config'

/**
 * OAuth sin backend: el flujo implicito de Google Identity Services entrega un
 * access token directamente al navegador. Dura una hora y se renueva en
 * silencio mientras la sesion de Google del usuario siga viva, asi que no hace
 * falta refresh token ni servidor que lo guarde.
 */

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

interface TokenClient {
  requestAccessToken: (opts?: { prompt?: string; hint?: string }) => void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string
            scope: string
            callback: (r: TokenResponse) => void
            error_callback?: (e: { type: string; message?: string }) => void
          }) => TokenClient
          revoke: (token: string, done?: () => void) => void
        }
      }
    }
  }
}

const STORAGE_KEY = 'cp.token'

let client: TokenClient | null = null
let token: string | null = null
let expiresAt = 0
let pending: {
  resolve: (t: string) => void
  reject: (e: Error) => void
} | null = null

const listeners = new Set<(signedIn: boolean) => void>()

export function onAuthChange(fn: (signedIn: boolean) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function emit() {
  const signedIn = isSignedIn()
  for (const fn of listeners) fn(signedIn)
}

/** Espera a que el script de Google acabe de cargar. */
function waitForGis(timeoutMs = 10_000): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(tick)
        resolve()
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(tick)
        reject(new Error('No se ha podido cargar Google Identity Services. ¿Hay conexión?'))
      }
    }, 50)
  })
}

/**
 * Recupera un token guardado si aun no ha caducado, para que recargar la pagina
 * dentro de la misma hora no obligue a repetir el consentimiento.
 */
function restore() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const saved = JSON.parse(raw) as { token: string; expiresAt: number }
    if (saved.expiresAt > Date.now() + 60_000) {
      token = saved.token
      expiresAt = saved.expiresAt
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // sessionStorage puede fallar en modo privado: no es critico.
  }
}
restore()

function persist() {
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token, expiresAt }))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* sin persistencia, solo se pierde la comodidad al recargar */
  }
}

export async function initAuth(): Promise<void> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error(
      'Falta VITE_GOOGLE_CLIENT_ID. Copia .env.example a .env.local y pega tu ID de cliente de Google.',
    )
  }
  await waitForGis()
  if (client) return

  client = window.google!.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_SCOPES,
    callback: (res) => {
      const p = pending
      pending = null
      if (res.access_token) {
        token = res.access_token
        // Un minuto de margen para no usar un token que caduca a mitad de peticion.
        expiresAt = Date.now() + (res.expires_in ?? 3600) * 1000 - 60_000
        persist()
        emit()
        p?.resolve(res.access_token)
      } else {
        const msg = res.error_description ?? res.error ?? 'Autorización cancelada'
        p?.reject(new Error(msg))
      }
    },
    error_callback: (err) => {
      const p = pending
      pending = null
      p?.reject(new Error(err.message ?? err.type))
    },
  })
}

export function isSignedIn(): boolean {
  return Boolean(token) && Date.now() < expiresAt
}

/**
 * Devuelve un token valido. Si `interactive` es false intenta renovarlo sin
 * mostrar nada (funciona si ya se dio el consentimiento antes); si es true
 * abre el popup de Google.
 */
export async function getToken(interactive = false): Promise<string> {
  if (isSignedIn()) return token!
  await initAuth()

  if (pending) throw new Error('Ya hay una autorización en curso')

  return new Promise<string>((resolve, reject) => {
    pending = { resolve, reject }
    try {
      // prompt vacio = intento silencioso; 'consent' fuerza la pantalla.
      client!.requestAccessToken({ prompt: interactive ? 'consent' : '' })
    } catch (e) {
      pending = null
      reject(e instanceof Error ? e : new Error(String(e)))
    }
  })
}

export async function signIn(): Promise<void> {
  await getToken(true)
}

/** Intento silencioso al arrancar. No lanza: si falla, se muestra el login. */
export async function trySilentSignIn(): Promise<boolean> {
  if (isSignedIn()) return true
  try {
    await getToken(false)
    return true
  } catch {
    return false
  }
}

export function signOut(): void {
  const old = token
  token = null
  expiresAt = 0
  persist()
  emit()
  if (old) window.google?.accounts.oauth2.revoke(old)
}

/** Invalida el token en memoria para forzar una renovacion en la proxima llamada. */
export function invalidateToken(): void {
  token = null
  expiresAt = 0
  persist()
  emit()
}
