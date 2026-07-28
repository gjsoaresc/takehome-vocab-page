import type { RewardState } from '../../lib/rewards'
import { CARD } from '../ui/Card'
import { group } from '../ui/CountUp'
import { ProgressBar } from '../ui/Progress'

/** Level, the bar to the next one, and the two thresholds it sits between. */
export function LevelStrip({ reward }: { reward: RewardState }) {
  const { level, levelTitle, xp, xpToNext, levelFloor, levelCeil, levelProgress } = reward
  return (
    <section className={`${CARD} px-4 py-3.5`} aria-label="Level progress">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] leading-[18px] font-semibold text-ink">
          Level {level} - {levelTitle}
        </h2>
        <p className="tabular text-xs leading-[18px] font-semibold text-xp">
          {xpToNext === null ? 'Top level reached' : `${group(xpToNext)} XP to level ${level + 1}`}
        </p>
      </div>
      <ProgressBar value={levelProgress} tone="xp" className="mt-2.5" label="Level progress" />
      <div className="tabular mt-1.5 flex justify-between text-[11px] leading-[14px] text-muted">
        <span>{group(levelFloor)}</span>
        <span className="font-semibold text-ink">{group(xp)} XP</span>
        <span>{levelCeil === null ? '-' : group(levelCeil)}</span>
      </div>
    </section>
  )
}
