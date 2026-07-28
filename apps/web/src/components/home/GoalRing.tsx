import type { FlameTier } from '../../lib/rewards'
import { Flame } from '../ui/Flame'
import { ProgressRing } from '../ui/Progress'

/**
 * The daily-goal ring with the streak inside it - the first thing on Home.
 *
 * Zero state gets a dashed empty track and no numbers at all: a brand-new
 * learner is never shown a fabricated streak.
 */
export function GoalRing({
  done,
  goal,
  streak,
  flame,
  fresh = false,
}: {
  done: number
  goal: number
  streak: number
  flame: FlameTier
  fresh?: boolean
}) {
  if (fresh) {
    return (
      <div className="relative grid h-[168px] w-[168px] place-items-center">
        <svg width="168" height="168" viewBox="0 0 168 168" aria-hidden="true">
          <circle
            cx="84"
            cy="84"
            r="71"
            fill="none"
            stroke="var(--color-line)"
            strokeWidth="13"
            strokeDasharray="4 11"
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute flex flex-col items-center gap-1.5">
          <Flame tier="none" size={38} />
          <span className="max-w-[110px] text-center text-[13px] leading-[17px] font-semibold text-muted">
            Your streak
            <br />
            starts today
          </span>
        </span>
      </div>
    )
  }

  return (
    <ProgressRing
      value={goal === 0 ? 0 : done / goal}
      size={184}
      stroke={14}
      tone={flame === 'atRisk' ? 'gold' : 'accent'}
      label={`${done} of ${goal} reviews done today`}
    >
      <Flame tier={flame} size={40} />
      <span className="tabular text-[44px] leading-[44px] font-bold tracking-[-0.03em] text-ink">
        {streak}
      </span>
      <span
        className={`text-[11px] leading-none font-semibold tracking-[0.08em] uppercase ${
          flame === 'atRisk' ? 'text-warn' : 'text-flame'
        }`}
      >
        {flame === 'atRisk' ? 'at risk' : `day streak`}
      </span>
    </ProgressRing>
  )
}
