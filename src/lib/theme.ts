/**
 * Tema (claro/oscuro) y acento de color. Se aplican como atributos en el
 * <html>; el CSS hace el resto. Ver src/index.css.
 */

export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

export const ACCENTS = ['azul', 'rosa', 'verde'] as const
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
}

/** Color con el que se pinta cada opcion en el selector de acento. */
export const ACCENT_SWATCH: Record<Accent, string> = {
  azul: '#38bdf8',
  rosa: '#ec4899',
  verde: '#10b981',
}

function prefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
}

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') return prefersDark() ? 'dark' : 'light'
  return theme
}

/**
 * Escribe el tema y el acento en el <html> y ajusta el color de la barra de
 * estado del movil para que no se quede del color anterior.
 */
export function applyTheme(theme: Theme, accent: Accent): void {
  const resolved = resolveTheme(theme)
  const root = document.documentElement
  root.dataset.theme = resolved
  root.dataset.accent = accent

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
