import type { RewardState } from '../../lib/rewards'
import { CARD } from '../ui/Card'
import { CountUp, group } from '../ui/CountUp'
import { ProgressBar } from '../ui/Progress'

/**
 * How close counts as "one more session away".
 *
 * Kept at the design's flat 200 rather than a share of the band, because 200 is
 * almost exactly one good day at this app's rates - a 12-review goal at
 * XP.perRating 10 plus XP.goalMet 30 is 150, a 20-review day is 230 - which is
 * the whole point of the node. A share of the band would glow for 4200 XP, or
 * weeks, inside the top level.
 */
const APPROACH_XP = 200

/** Level, the bar to the next one, and the two thresholds it sits between. */
export function LevelStrip({ reward }: { reward: RewardState }) {
  const { level, levelTitle, xp, xpToNext, levelFloor, levelCeil, levelProgress } = reward
  // null at the cap, where there is no next level to approach.
  const approaching = xpToNext !== null && xpToNext <= APPROACH_XP

  return (
    <section className={`${CARD} px-4 py-3.5`} aria-label="Level progress">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] leading-[18px] font-semibold text-ink">
          Level {level} - {levelTitle}
        </h2>
        <p className="tabular text-xs leading-[18px] font-semibold text-xp">
          {xpToNext === null ? (
            'Top level reached'
          ) : (
            <CountUp to={xpToNext} suffix={` XP to level ${level + 1}`} />
          )}
        </p>
      </div>
      {/* The node has to sit outside ProgressBar's own overflow-hidden track,
          so it hangs off this wrapper rather than living inside the bar. */}
      <div className="relative mt-2.5">
        <ProgressBar value={levelProgress} tone="xp" label="Level progress" />
        {approaching ? (
          <span
            aria-hidden
            className="animate-pulse-end absolute top-1/2 -right-[3px] h-[18px] w-[18px] -translate-y-1/2 rounded-full border-2 border-xp bg-xp-soft"
          />
        ) : null}
      </div>
      <div className="tabular mt-1.5 flex justify-between text-[11px] leading-[14px] text-muted">
        <span>{group(levelFloor)}</span>
        <span className="font-semibold text-ink">{group(xp)} XP</span>
        <span>{levelCeil === null ? '-' : group(levelCeil)}</span>
      </div>
    </section>
  )
}
