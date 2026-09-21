/**
 * Tema (claro/oscuro) y colores. Se aplican como atributos y variables en el
 * <html>; el CSS hace el resto. Ver src/index.css.
 */

export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

export const ACCENTS = ['azul', 'rosa', 'verde', 'propio'] as const
export type Accent = (typeof ACCENTS)[number]

export const THEME_LABELS: Record<Theme, string> = {
  system: 'Automático',
  light: 'Claro',
  dark: 'Oscuro',
}

export const ACCENT_LABELS: Record<Accent, string> = {
  azul: 'Azul',
  rosa: 'Rosa',
  verde: 'Verde',
  propio: 'A mi gusto',
}

/**
 * Colores elegidos a mano. `null` en `ours` o `chrome` significa "calcúlalo":
 * "Nosotros" es la mezcla de los dos, y el de la interfaz el opuesto a
 * "Nosotros".
 */
export interface CustomColors {
  mine: string
  hers: string
  ours: string | null
  chrome: string | null
}

export const DEFAULT_CUSTOM_COLORS: CustomColors = {
  mine: '#2563eb',
  hers: '#ca8a04',
  ours: null,
  chrome: null,
}

/** Lo que necesita `applyTheme` para pintar la app. */
export interface ThemeConfig {
  theme: Theme
  accent: Accent
  customColors: CustomColors
  /** Intercambia los dos colores de persona dentro del tema elegido. */
  swapPeople: boolean
}

/**
 * Los tres colores de calendario de cada tema, para pintarlos en el selector.
 * El tercero es la mezcla de los dos primeros.
 *
 * El trio va en el lado opuesto del circulo cromatico al color del tema, para
 * que "Nosotros" no se confunda con los botones, el dia de hoy o la tarjeta
 * del contador, que van del color del tema. Ver la tabla en index.css.
 */
export const ACCENT_TRIAD: Record<Exclude<Accent, 'propio'>, [string, string, string]> = {
  azul: ['#db2777', '#65a30d', '#d97706'], // rosa + lima = ámbar
  rosa: ['#2563eb', '#ca8a04', '#16a34a'], // azul + amarillo = verde
  verde: ['#7c3aed', '#ea580c', '#db2777'], // violeta + naranja = rosa
}

function prefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
}

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') return prefersDark() ? 'dark' : 'light'
  return theme
}

/** El color de "Nosotros": el elegido a mano, o la mezcla de los otros dos. */
export function resolveOurs(custom: CustomColors): string {
  return custom.ours ?? mixColors(custom.mine, custom.hers)
}

/**
 * Color de la interfaz (botones, dia de hoy, contador…) con colores a medida.
 * Si no se ha elegido, se saca del opuesto a "Nosotros", que es lo que
 * garantiza que no se parezca a ninguno de los tres del calendario.
 */
export function resolveChrome(custom: CustomColors): string {
  return custom.chrome ?? complement(resolveOurs(custom))
}

/** Separacion de tono entre dos colores, de 0 a 180 grados. */
export function hueDistance(a: string, b: string): number {
  const A = hexToHsl(a)
  const B = hexToHsl(b)
  if (!A || !B) return 180
  const d = Math.abs(A.h - B.h) % 360
  return d > 180 ? 360 - d : d
}

/**
 * Escribe el tema y los colores en el <html> y ajusta el color de la barra de
 * estado del movil para que no se quede del anterior.
 */
export function applyTheme({ theme, accent, customColors, swapPeople }: ThemeConfig): void {
  const resolved = resolveTheme(theme)
  const root = document.documentElement
  root.dataset.theme = resolved
  root.dataset.accent = accent

  // Con colores a medida cada uno se elige directamente, asi que intercambiar
  // no tendria sentido.
  if (swapPeople && accent !== 'propio') root.dataset.swap = '1'
  else delete root.dataset.swap

  if (accent === 'propio') {
    root.style.setProperty('--u-mine', customColors.mine)
    root.style.setProperty('--u-hers', customColors.hers)
    root.style.setProperty('--u-ours', resolveOurs(customColors))
    root.style.setProperty('--u-chrome', resolveChrome(customColors))
  } else {
    // Sin limpiar, los colores a medida seguirian ganando al volver a un tema.
    for (const v of ['--u-mine', '--u-hers', '--u-ours', '--u-chrome']) {
      root.style.removeProperty(v)
    }
  }

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    // Se lee del CSS ya aplicado, asi no hay que duplicar los valores aqui.
    const bg = getComputedStyle(root).getPropertyValue('--c-bg').trim()
    if (bg) meta.setAttribute('content', bg)
  }
}

/** Avisa cuando el sistema cambia de claro a oscuro, para el modo automatico. */
export function onSystemThemeChange(fn: () => void): () => void {
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
  if (!mq) return () => {}
  mq.addEventListener('change', fn)
  return () => mq.removeEventListener('change', fn)
}

/* ---------- mezcla de colores ---------- */

/**
 * Mezcla dos colores por el tono, no por sus componentes RGB. Es la diferencia
 * entre mezclar pintura y mezclar luz: en RGB, azul + amarillo da gris, y por
 * el tono da verde, que es lo que espera cualquiera. Se promedian saturacion y
 * luminosidad.
 */
export function mixColors(a: string, b: string): string {
  const A = hexToHsl(a)
  const B = hexToHsl(b)
  if (!A || !B) return a

  // Dos caminos posibles para ir de un tono al otro: el directo (sin pasar por
  // el rojo del 0) y el que cruza el 0.
  const direct = Math.abs(B.h - A.h)
  const wrap = 360 - direct

  /*
   * Normalmente se toma el mas corto. Pero con dos colores casi opuestos los
   * dos caminos miden casi lo mismo y el punto medio puede caer en dos sitios
   * a 180 grados el uno del otro: azul y amarillo estan a 181, y por un grado
   * la mezcla salia magenta en vez de verde. En esos casos se toma el camino
   * directo, que es el que da el resultado que espera cualquiera (azul +
   * amarillo = verde, como la pintura).
   */
  const h =
    direct <= wrap + 20
      ? Math.min(A.h, B.h) + direct / 2
      : (Math.max(A.h, B.h) + wrap / 2) % 360

  return hslToHex({ h, s: (A.s + B.s) / 2, l: (A.l + B.l) / 2 })
}

/** El color de enfrente en el circulo cromatico. */
function complement(hex: string): string {
  const c = hexToHsl(hex)
  if (!c) return hex
  // Se sube un poco la saturacion: el opuesto de un color apagado queda soso.
  return hslToHex({ h: (c.h + 180) % 360, s: Math.max(c.s, 0.55), l: c.l })
}

interface Hsl {
  h: number
  s: number
  l: number
}

function hexToHsl(hex: string): Hsl | null {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min

  if (d === 0) return { h: 0, s: 0, l }

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
  else if (max === g) h = ((b - r) / d + 2) * 60
  else h = ((r - g) / d + 4) * 60

  return { h, s, l }
}

function hslToHex({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2

  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]

  const to255 = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')

  return `#${to255(r)}${to255(g)}${to255(b)}`
}
