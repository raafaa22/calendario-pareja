import { togetherBreakdown } from '../lib/dates'

interface Props {
  onLogin: () => void
  error: string | null
  busy: boolean
  /** Nombre de la ultima cuenta usada, si la sesion caducó. */
  knownName?: string
}

export default function Login({ onLogin, error, busy, knownName }: Props) {
  const { days } = togetherBreakdown()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
      <div>
        <div className="mx-auto h-14 w-14 rounded-2xl bg-accent" />
        <h1 className="mt-4 text-2xl font-bold">Nuestro calendario</h1>
        <p className="mt-1.5 text-sm text-subtle">{days.toLocaleString('es-ES')} días juntos</p>
      </div>

      <p className="max-w-xs text-sm leading-relaxed text-subtle">
        {knownName
          ? `${knownName}, la sesión ha caducado. Vuelve a entrar y seguimos.`
          : 'Entra con tu cuenta de Google. La app lee y escribe directamente en vuestros calendarios: no guarda nada en ningún servidor.'}
      </p>

      <button
        type="button"
        onClick={onLogin}
        disabled={busy}
        className="tap flex items-center gap-2.5 rounded-full border border-line bg-white px-5 py-3 text-sm font-semibold text-[#1f1f1f] disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.8-6.8C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.4 17.7 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-2.8-.4-4.1H24v8.1h12.6c-.3 2.1-1.6 5.2-4.6 7.3l7.7 6c4.5-4.2 6.4-10.2 6.4-17.3z" />
          <path fill="#FBBC05" d="M10.5 28.6a14.4 14.4 0 0 1 0-9.2l-7.9-6.2a24 24 0 0 0 0 21.6l7.9-6.2z" />
          <path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.7-5.9l-7.7-6c-2.1 1.4-4.9 2.4-8 2.4-6.3 0-11.6-3.9-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z" />
        </svg>
        {busy ? 'Entrando…' : knownName ? `Entrar como ${knownName}` : 'Entrar con Google'}
      </button>

      {error && (
        <p className="max-w-xs rounded-xl border border-danger-line bg-danger-soft px-3 py-2 text-xs leading-relaxed text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
