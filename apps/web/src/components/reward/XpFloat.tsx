import { usePrefersReducedMotion } from '../../lib/motion'
import { Icon } from '../ui/Icon'

/**
 * Micro tier, 240ms: a "+N XP" chip that floats 46px and fades.
 *
 * Purely decorative - it is aria-hidden and pointer-events-none, because the
 * screen underneath already announces the same outcome through its own
 * role="status" region. Under reduced motion it holds in place instead of
 * travelling, so the number is still readable.
 */
export function XpFloat({
  amount,
  tone = 'ok',
  label,
}: {
  amount: number
  tone?: 'ok' | 'err'
  label?: string
}) {
  const reduced = usePrefersReducedMotion()
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3.5 py-2 shadow-e2 ${
        tone === 'ok' ? 'bg-ok text-on-ok' : 'bg-err text-on-err'
      } ${reduced ? 'opacity-100' : 'animate-float-up'}`}
    >
      <Icon name={tone === 'ok' ? 'check' : 'cross'} size={16} strokeWidth={3} />
      <span className="tabular text-sm font-extrabold">
        {label ?? `+${amount}`}
      </span>
    </span>
  )
}
