import { Icon } from '../ui/Icon'

/**
 * The HUD. In the last ten seconds the timer inverts to a solid flame fill,
 * counts in tenths and pulses - three signals, so the escalation survives both
 * colour blindness and reduced motion (which drops only the pulse).
 */
export function RushHud({
  msLeft,
  score,
  streak,
  multiplier,
  totalMs,
}: {
  msLeft: number
  score: number
  streak: number
  multiplier: number
  totalMs: number
}) {
  const seconds = msLeft / 1000
  const urgent = seconds <= 10
  const clock = urgent ? seconds.toFixed(1) : `0:${String(Math.ceil(seconds)).padStart(2, '0')}`
  const toNext = 5 - (streak % 5)

  return (
    <div>
      <div className="flex items-center gap-2.5">
        <span
          className={`inline-flex h-10 items-center gap-[7px] rounded-full border-[1.5px] px-3.5 transition-colors duration-300 ${
            urgent
              ? 'animate-urgent border-flame bg-flame text-on-flame'
              : 'border-line bg-card text-ink'
          }`}
        >
          <Icon name="timer" size={16} strokeWidth={2.4} />
          <span className="tabular text-[17px] font-bold">{clock}</span>
        </span>

        <span className="flex-1 text-right">
          <span className="tabular block text-[26px] leading-7 font-bold tracking-[-0.02em] text-ink">
            {score}
          </span>
          <span className="block text-[10.5px] leading-none font-semibold tracking-[0.06em] text-muted uppercase">
            points
          </span>
        </span>

        <span
          className={`inline-flex h-10 flex-none items-center gap-1.5 rounded-full border-[1.5px] px-3 ${
            multiplier > 1
              ? 'border-flame bg-flame-soft text-flame'
              : 'border-line bg-card text-muted'
          }`}
        >
          <Icon name="flame" size={15} filled />
          <span className="tabular text-[15px] font-extrabold">x{multiplier}</span>
        </span>
      </div>

      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ease-linear ${urgent ? 'bg-flame' : 'bg-ink'}`}
          style={{ width: `${Math.max(0, (msLeft / totalMs) * 100)}%` }}
        />
      </div>

      <div className="tabular mt-1.5 flex justify-between text-[11.5px] leading-none font-semibold">
        <span className="text-muted">{streak > 0 ? `${streak} in a row` : 'no streak yet'}</span>
        <span className={multiplier < 4 ? 'text-muted' : 'text-flame'}>
          {multiplier < 4 ? `${toNext} more for x${multiplier + 1}` : 'max multiplier'}
        </span>
      </div>
    </div>
  )
}
