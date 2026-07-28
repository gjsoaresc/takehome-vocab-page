import type { Badge } from '../../lib/rewards'
import { CountUp, group } from '../ui/CountUp'
import { Icon } from '../ui/Icon'
import { ProgressBar, ProgressRing } from '../ui/Progress'
import { RewardSheet } from './RewardSheet'

export interface LevelUpPayload {
  level: number
  title: string
  xp: number
  xpToNext: number | null
  levelProgress: number
  stats: Array<{ value: string; label: string; tone: 'xp' | 'accent' | 'flame' }>
}

const TONE: Record<'xp' | 'accent' | 'flame', string> = {
  xp: 'bg-xp-soft text-xp',
  accent: 'bg-accent-soft text-accent-strong',
  flame: 'bg-flame-soft text-flame',
}

/**
 * Level-up, large tier. Sheet rises 420ms, ring sweeps 900ms, the number pops.
 * A second row is appended when a badge landed in the same session, so a
 * level-up and an unlock never produce two sheets back to back.
 */
export function LevelUpSheet({
  payload,
  alsoUnlocked,
  onDismiss,
}: {
  payload: LevelUpPayload
  alsoUnlocked?: Badge
  onDismiss: () => void
}) {
  const { level, title, xp, xpToNext, levelProgress, stats } = payload
  return (
    <RewardSheet onDismiss={onDismiss} dismissLabel="Keep going" labelledBy="levelup-title">
      {/* White is correct here and only here: the celebrate gradient is a fixed
          three-stop ramp that does not change with the theme, and its lightest
          stop (#4f46e5) still clears 7.7:1 against white. */}
      <span className="celebrate animate-sheen inline-flex h-[26px] items-center rounded-full bg-[length:360px_100%] px-3 text-[11px] leading-none font-bold tracking-[0.08em] text-white uppercase">
        Level up
      </span>

      <ProgressRing value={1} size={170} stroke={14} tone="xp" className="mt-4" aria-hidden>
        <span className="animate-pop-reward flex flex-col items-center">
          <span className="text-[11px] leading-none font-semibold tracking-[0.1em] text-muted uppercase">
            Level
          </span>
          <span className="tabular text-[62px] leading-[62px] font-extrabold tracking-[-0.04em] text-ink">
            {level}
          </span>
        </span>
      </ProgressRing>

      <h2 id="levelup-title" className="mt-3 text-xl font-bold tracking-[-0.02em] text-ink">
        {title}
      </h2>
      <p className="mt-0.5 max-w-[250px] text-center text-[13.5px] leading-[19px] text-muted">
        <CountUp to={xp} suffix=" XP" /> earned so far.
      </p>

      <div className="mt-4 w-full">
        <div className="tabular flex justify-between text-[11.5px] leading-none font-semibold text-muted">
          <span className="text-xp">L{level}</span>
          <span>{xpToNext === null ? 'Top level' : `${group(xpToNext)} XP to L${level + 1}`}</span>
        </div>
        <ProgressBar value={levelProgress} tone="xp" className="mt-1.5" />
      </div>

      <div className="mt-3.5 flex w-full gap-2">
        {stats.map((s) => (
          <div key={s.label} className={`flex-1 rounded-lg px-1.5 py-2.5 text-center ${TONE[s.tone]}`}>
            <div className="tabular text-[15px] leading-5 font-bold">{s.value}</div>
            <div className="text-[10px] leading-[13px] font-medium text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      {alsoUnlocked ? (
        <div className="mt-3.5 flex w-full items-center gap-2.5 rounded-lg border border-line bg-paper px-3 py-2.5">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-[13px] bg-gold-soft text-gold">
            <Icon name="star" size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold text-ink">
              Badge unlocked - {alsoUnlocked.name}
            </span>
            <span className="block font-mono text-[11px] text-muted">
              {alsoUnlocked.condition}
            </span>
          </span>
        </div>
      ) : null}
    </RewardSheet>
  )
}
