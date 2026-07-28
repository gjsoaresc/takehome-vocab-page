import type { GameCardDto } from '@vocab/shared'
import { Link } from 'react-router-dom'
import { buttonClass } from '../ui/Button'
import { CountUp } from '../ui/CountUp'
import { Icon } from '../ui/Icon'

export interface MissedPair {
  card: GameCardDto
  /** Why it was missed, in the design's own phrasing. */
  note: string
}

interface GameOverProps {
  score: number
  bestStreak: number
  judged: number
  correct: number
  xpEarned: number
  missed: MissedPair[]
  /** Highest score on this device before this run. */
  previousBest: number
  isRecord: boolean
  onReplay: () => void
}

export function GameOver({
  score,
  bestStreak,
  judged,
  correct,
  xpEarned,
  missed,
  previousBest,
  isRecord,
  onReplay,
}: GameOverProps) {
  const accuracy = judged === 0 ? 0 : Math.round((correct / judged) * 100)
  const topMultiplier = Math.min(4, 1 + Math.floor(bestStreak / 5))
  const delta = score - previousBest

  const pbLabel =
    previousBest === 0
      ? 'First run on this device'
      : isRecord
        ? `+${delta} over your best`
        : delta === 0
          ? 'Matched your best'
          : `${delta} from your best of ${previousBest}`

  return (
    <div className="flex flex-col gap-4">
      <div className={isRecord ? 'celebrate rounded-2xl p-[1.5px]' : ''}>
        <div
          className={`flex flex-col items-center rounded-[26.5px] bg-card px-4 pt-6 pb-5 ${
            isRecord ? '' : 'border border-line'
          }`}
        >
          {isRecord ? (
            <span className="celebrate animate-pop-reward inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[11.5px] leading-none font-bold tracking-[0.06em] text-white uppercase">
              <Icon name="star" size={14} filled />
              Personal best
            </span>
          ) : null}

          <p className="mt-3.5 text-xs leading-none font-bold tracking-[0.1em] text-muted uppercase">
            Final score
          </p>
          <p className="tabular mt-1 text-[62px] leading-[64px] font-extrabold tracking-[-0.04em] text-ink">
            {score}
          </p>

          <span
            className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${
              isRecord ? 'bg-gold-soft text-gold' : 'bg-paper text-muted'
            }`}
          >
            <Icon name={isRecord ? 'arrowUp' : 'arrowDown'} size={14} strokeWidth={2.6} />
            <span className="tabular text-[12.5px] font-bold">{pbLabel}</span>
          </span>

          <div className="mt-4.5 flex w-full gap-2">
            {[
              { v: `x${topMultiplier}`, l: 'top multiplier', c: 'bg-flame-soft text-flame' },
              { v: String(bestStreak), l: 'best streak', c: 'bg-accent-soft text-accent-strong' },
              { v: `${accuracy}%`, l: 'accuracy', c: 'bg-ok-soft text-ok' },
            ].map((s) => (
              <div key={s.l} className={`flex-1 rounded-lg px-1.5 py-2.5 text-center ${s.c}`}>
                <div className="tabular text-base leading-[21px] font-bold">{s.v}</div>
                <div className="text-[10px] leading-[13px] font-medium text-muted">{s.l}</div>
              </div>
            ))}
            <div className="flex-1 rounded-lg bg-xp-soft px-1.5 py-2.5 text-center">
              <div className="text-base leading-[21px] font-bold text-xp">
                <CountUp to={xpEarned} prefix="+" />
              </div>
              <div className="text-[10px] leading-[13px] font-medium text-muted">XP</div>
            </div>
          </div>
        </div>
      </div>

      {missed.length > 0 ? (
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] leading-none font-semibold tracking-[0.08em] text-muted uppercase">
              Missed pairs
            </span>
            <span className="tabular text-xs font-semibold text-muted">{missed.length}</span>
          </div>
          <ul className="mt-2.5 flex flex-col gap-2">
            {missed.slice(0, 8).map((m, i) => (
              <li key={`${m.card.word_id}-${i}`}>
                <Link
                  to={`/learn?word=${m.card.word_id}`}
                  className="flex min-h-[60px] items-center gap-2.5 rounded-[18px] border border-line bg-card px-3 py-3"
                >
                  <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[10px] bg-err-soft text-err">
                    <Icon name="cross" size={16} strokeWidth={3} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] leading-5 font-semibold text-ink">
                      {m.card.headword}
                    </span>
                    <span className="block text-[12.5px] leading-[17px] text-muted">{m.note}</span>
                  </span>
                  <Icon name="chevronRight" size={16} strokeWidth={2.2} className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onReplay}
          className={buttonClass('flame', 'w-full !rounded-[18px]')}
        >
          Run it back
        </button>
        <Link
          to={missed.length > 0 ? `/learn?word=${missed[0]!.card.word_id}` : '/'}
          className={buttonClass('secondary', 'w-full !border-line !text-ink')}
        >
          {missed.length > 0 ? `Study ${missed.length} missed words` : 'Back to home'}
        </Link>
      </div>
    </div>
  )
}
