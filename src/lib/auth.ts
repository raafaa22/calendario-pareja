import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from './config'

/**
 * OAuth sin backend: el flujo implicito de Google Identity Services entrega un
 * access token directamente al navegador.
 *
 * Sobre la persistencia de la sesion, que tiene un techo real: Google solo
 * emite tokens de una hora y no da refresh token a una app sin servidor. Lo
 * que si se puede hacer, y es lo que hace este modulo, es:
 *
 *  1. Guardar el token en localStorage (no sessionStorage), para que cerrar la
 *     app y volver a abrirla dentro de esa hora no pida nada.
 *  2. Recordar con que cuenta se entro y pasarsela a Google como `hint`, para
 *     que la renovacion silenciosa acierte de cuenta sin preguntar.
 *  3. Renovar en silencio al arrancar y cada vez que la API responde 401.
 *
 * Con eso el boton de Google solo reaparece si Google cierra su propia sesion
 * en el navegador o si se cierra sesion a mano.
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

/** Datos de la cuenta que se usan para personalizar la interfaz. */
export interface Profile {
  email: string
  name: string
  givenName: string
  picture?: string
}

const TOKEN_KEY = 'cp.token'
const PROFILE_KEY = 'cp.profile'

let client: TokenClient | null = null
let token: string | null = null
let expiresAt = 0
let profile: Profile | null = null
let pending: { resolve: (t: string) => void; reject: (e: Error) => void } | null = null

const listeners = new Set<() => void>()

export function onAuthChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function emit() {
  for (const fn of listeners) fn()
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* modo privado o cuota llena: la app sigue funcionando en memoria */
  }
}

// Al cargar el modulo se recupera lo guardado. El perfil se conserva aunque el
// token haya caducado: sirve para saludar por su nombre y para el `hint`.
;(function restore() {
  profile = read<Profile>(PROFILE_KEY)
  const saved = read<{ token: string; expiresAt: number }>(TOKEN_KEY)
  if (saved && saved.expiresAt > Date.now() + 60_000) {
    token = saved.token
    expiresAt = saved.expiresAt
  } else if (saved) {
    write(TOKEN_KEY, null)
  }
})()

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
        write(TOKEN_KEY, { token, expiresAt })
        emit()
        // El perfil se refresca en segundo plano: no debe retrasar la entrada.
        void refreshProfile()
        p?.resolve(res.access_token)
      } else {
        p?.reject(new Error(res.error_description ?? res.error ?? 'Autorización cancelada'))
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

export function getProfile(): Profile | null {
  return profile
}

/**
 * Devuelve un token valido. Si `interactive` es false intenta renovarlo sin
 * mostrar nada, apoyandose en la cuenta recordada.
 */
export async function getToken(interactive = false): Promise<string> {
  if (isSignedIn()) return token!
  await initAuth()
  if (pending) throw new Error('Ya hay una autorización en curso')

  return new Promise<string>((resolve, reject) => {
    pending = { resolve, reject }
    try {
      client!.requestAccessToken({
        // prompt vacio = intento silencioso; 'consent' fuerza la pantalla.
        prompt: interactive ? 'consent' : '',
        // Con el correo recordado, Google renueva sobre esa cuenta sin
        // preguntar cual, incluso si hay varias abiertas en el navegador.
        ...(profile?.email && !interactive ? { hint: profile.email } : {}),
      })
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
  if (isSignedIn()) {
    // Token valido de una sesion anterior: conviene confirmar que el perfil
    // guardado sigue siendo el de esa cuenta.
    void refreshProfile()
    return true
  }
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
  profile = null
  write(TOKEN_KEY, null)
  write(PROFILE_KEY, null)
  emit()
  if (old) window.google?.accounts.oauth2.revoke(old)
}

/** Invalida el token en memoria para forzar una renovacion en la proxima llamada. */
export function invalidateToken(): void {
  token = null
  expiresAt = 0
  write(TOKEN_KEY, null)
  emit()
}

/** Lee nombre, correo y foto de la cuenta con el token actual. */
async function refreshProfile(): Promise<void> {
  if (!token) return
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const me = (await res.json()) as {
      email?: string
      name?: string
      given_name?: string
      picture?: string
    }
    if (!me.email) return

    const next: Profile = {
      email: me.email,
      name: me.name ?? me.email,
      givenName: me.given_name ?? me.name?.split(' ')[0] ?? me.email.split('@')[0],
      picture: me.picture,
    }
    // Solo se avisa si algo ha cambiado, para no repintar por nada.
    if (JSON.stringify(next) !== JSON.stringify(profile)) {
      profile = next
      write(PROFILE_KEY, next)
      emit()
    }
  } catch {
    /* sin perfil la app funciona igual, solo pierde la personalizacion */
  }
}
