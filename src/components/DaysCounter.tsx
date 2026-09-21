import { useEffect, useState } from 'react'
import { togetherBreakdown } from '../lib/dates'

/**
 * Contador de dias juntos. Se recalcula solo al cruzar la medianoche, no hace
 * falta un temporizador por segundo.
 */
export default function DaysCounter() {
  const [stats, setStats] = useState(() => togetherBreakdown())

  useEffect(() => {
    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const timer = setTimeout(
      () => setStats(togetherBreakdown()),
      midnight.getTime() - now.getTime() + 1000,
    )
    return () => clearTimeout(timer)
  }, [stats])

  const { days, years, months, restDays, nextMonthlyIn } = stats

  const parts = [
    years > 0 && `${years} ${years === 1 ? 'año' : 'años'}`,
    months > 0 && `${months} ${months === 1 ? 'mes' : 'meses'}`,
    restDays > 0 && `${restDays} ${restDays === 1 ? 'día' : 'días'}`,
  ].filter(Boolean) as string[]

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-accent-line bg-accent-soft px-4 py-2.5">
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums tracking-tight text-fg">
            {days.toLocaleString('es-ES')}
          </span>
          <span className="text-sm text-muted">días juntos</span>
        </div>
        {parts.length > 0 && (
          <div className="mt-0.5 text-[11px] text-subtle">{formatList(parts)}</div>
        )}
      </div>

      <div className="shrink-0 text-right text-[10px] leading-tight text-subtle">
        {nextMonthlyIn === 0 ? (
          <span className="text-accent">Hoy hacéis meses</span>
        ) : (
          <>
            Siguiente mes
            <br />
            en {nextMonthlyIn} {nextMonthlyIn === 1 ? 'día' : 'días'}
          </>
        )}
      </div>
    </div>
  )
}

/** "3 años, 9 meses y 30 días" */
function formatList(parts: string[]): string {
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`
}
