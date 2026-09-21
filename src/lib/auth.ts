import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from './config'

/**
 * OAuth sin backend: el flujo implicito de Google Identity Services entrega un
 * access token directamente al navegador.
 *
 * DOS LIMITES que conviene tener claros, porque marcan el diseno de todo esto:
 *
 *  1. Google solo emite tokens de UNA HORA y no da refresh token a una app que
 *     no puede guardar un secreto. Sin servidor no hay forma de saltarselo.
 *  2. El cliente de tokens de GIS funciona con una VENTANA EMERGENTE, y una
 *     emergente que no nace de un toque del usuario la bloquea el navegador.
 *     No existe modo silencioso de verdad: llamarlo al arrancar solo consigue
 *     que el navegador bloquee la emergente, y encima tarda varios segundos en
 *     rendirse.
 *
 * Asi que este modulo NO intenta renovar por su cuenta. Lo que hace es:
 *
 *  - Guardar el token en localStorage, para que cerrar la app y volver a
 *    abrirla dentro de esa hora no pida nada.
 *  - Recordar con que cuenta se entro, para dirigir el siguiente acceso a esa
 *    cuenta (`hint`) y poder saludar por su nombre.
 *  - Cuando el token caduca, volver a la pantalla de entrada. Un toque, sin
 *    elegir cuenta ni volver a dar permisos.
 *
 * Para que fuera de verdad automatico habria que cambiar a redireccion de
 * pagina completa con `prompt=none`, que si vuelve con un token nuevo sin
 * interaccion. Eso obliga a registrar una URI de redireccion en Google Cloud.
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
 * Devuelve el token guardado si sigue vivo. No habla con Google: hacerlo aqui
 * significaria abrir una emergente sin un toque del usuario, que el navegador
 * bloquea. Si ha caducado, se avisa a la app para que muestre la entrada.
 */
export async function getToken(): Promise<string> {
  if (isSignedIn()) return token!
  invalidateToken()
  throw new Error('La sesión ha caducado. Vuelve a entrar con Google.')
}

/** Entrada con Google. Solo se llama desde un toque del usuario. */
export async function signIn(): Promise<void> {
  await initAuth()
  if (pending) throw new Error('Ya hay una autorización en curso')

  await new Promise<string>((resolve, reject) => {
    pending = { resolve, reject }
    try {
      client!.requestAccessToken({
        // Vacio (no 'consent'): si ya se dieron los permisos, Google no vuelve
        // a preguntar y entra directo.
        prompt: '',
        // Con el correo recordado no hay que elegir cuenta, aunque haya varias
        // abiertas en el navegador.
        ...(profile?.email ? { hint: profile.email } : {}),
      })
    } catch (e) {
      pending = null
      reject(e instanceof Error ? e : new Error(String(e)))
    }
  })
}

/**
 * Recupera la sesion guardada al arrancar. Es sincrono a proposito: no hay
 * nada que preguntarle a Google, asi que la app no tiene por que ensenar una
 * pantalla de carga mientras espera.
 */
export function restoreSession(): boolean {
  if (!isSignedIn()) return false
  // Confirma que el perfil guardado sigue siendo el de esa cuenta.
  void refreshProfile()
  return true
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
