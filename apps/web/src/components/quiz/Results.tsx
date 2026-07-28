import { Link } from 'react-router-dom'
import type { Badge } from '../../lib/rewards'
import { BADGE_ICON } from '../reward/BadgeSheet'
import { buttonClass } from '../ui/Button'
import { CountUp } from '../ui/CountUp'
import { Icon } from '../ui/Icon'
import { ProgressRing } from '../ui/Progress'
import type { Answered } from './QuizCard'

export type { Answered as AnsweredQuestion }

interface ResultsProps {
  answers: Answered[]
  bestCombo: number
  xpEarned: number
  streak: number
  /** Badges that flipped to earned during this session, if any. */
  unlocked: Badge[]
  onPlayAgain: () => void
}

/**
 * The session as a reward moment, not a receipt: accuracy ring, XP counted up,
 * best combo, any badge that landed, then the missed words as the primary path
 * back into Learn. A perfect ten gets its own gradient treatment.
 */
export function Results({
  answers,
  bestCombo,
  xpEarned,
  streak,
  unlocked,
  onPlayAgain,
}: ResultsProps) {
  const missed = answers.filter((a) => a.chosen !== a.question.answer)
  const score = answers.length - missed.length
  const accuracy = answers.length === 0 ? 0 : score / answers.length
  const perfect = missed.length === 0 && answers.length > 0

  const title = perfect
    ? 'Ten for ten'
    : score >= 8
      ? 'Strong round'
      : score >= 5
        ? 'Solid work'
        : 'Rough round - that is data'

  const body = perfect
    ? 'No misses, no hesitation.'
    : `${missed.length} to clean up. Studying them now is worth more than another quiz.`

  return (
    <div className="flex flex-col gap-4">
      <div className={perfect ? 'celebrate rounded-2xl p-[1.5px]' : ''}>
        <div
          className={`flex flex-col items-center rounded-[26.5px] bg-card px-4 pt-5 pb-5 ${
            perfect ? '' : 'border border-line'
          }`}
        >
          {perfect ? (
            <span className="celebrate animate-sheen inline-flex h-7 items-center gap-1.5 rounded-full bg-[length:320px_100%] px-3 text-[11.5px] leading-none font-bold tracking-[0.06em] text-white uppercase">
              <Icon name="star" size={14} filled />
              Flawless
            </span>
          ) : null}

          <ProgressRing
            value={accuracy}
            size={150}
            stroke={13}
            tone={perfect ? 'gold' : score >= 7 ? 'ok' : 'accent'}
            className="mt-3"
            label={`${score} of ${answers.length} correct`}
          >
            <span className="tabular text-[42px] leading-[44px] font-bold tracking-[-0.03em] text-ink">
              {score}
            </span>
            <span className="text-xs leading-none font-semibold text-muted">
              of {answers.length} correct
            </span>
          </ProgressRing>

          <h1 className="mt-3 text-center text-lg font-bold tracking-[-0.02em] text-ink">{title}</h1>
          <p className="mt-0.5 max-w-[280px] text-center text-[13.5px] leading-[19px] text-muted">
            {body}
          </p>

          <div className="mt-4 flex w-full gap-2">
            <div className="flex-1 rounded-lg bg-accent-soft px-2 py-2.5 text-center">
              <div className="tabular text-[17px] leading-[22px] font-bold text-accent-strong">
                {Math.round(accuracy * 100)}%
              </div>
              <div className="text-[10.5px] leading-[14px] font-medium text-muted">accuracy</div>
            </div>
            <div className="flex-1 rounded-lg bg-xp-soft px-2 py-2.5 text-center">
              <div className="text-[17px] leading-[22px] font-bold text-xp">
                <CountUp to={xpEarned} prefix="+" />
              </div>
              <div className="text-[10.5px] leading-[14px] font-medium text-muted">XP earned</div>
            </div>
            <div className="flex-1 rounded-lg bg-flame-soft px-2 py-2.5 text-center">
              <div className="tabular text-[17px] leading-[22px] font-bold text-flame">
                x{bestCombo}
              </div>
              <div className="text-[10.5px] leading-[14px] font-medium text-muted">best combo</div>
            </div>
          </div>

          {streak > 0 ? (
            <p className="mt-3 text-[12.5px] text-muted">
              Day {streak} of your streak is still going.
            </p>
          ) : null}
        </div>
      </div>

      {unlocked.map((b) => (
        <div key={b.id} className="celebrate rounded-[20px] p-[1.5px]">
          <div className="flex items-center gap-3 rounded-[18.5px] bg-card px-3.5 py-3">
            <span className="animate-pop-reward grid h-11 w-11 flex-none place-items-center rounded-[15px] bg-gold-soft text-gold">
              <Icon name={BADGE_ICON[b.id] ?? 'star'} size={24} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm leading-[19px] font-bold text-ink">
                Badge unlocked - {b.name}
              </span>
              <span className="block font-mono text-xs leading-4 text-muted">{b.condition}</span>
            </span>
          </div>
        </div>
      ))}

      {missed.length > 0 ? (
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] leading-none font-semibold tracking-[0.08em] text-muted uppercase">
              Missed words
            </span>
            <span className="tabular text-xs font-semibold text-muted">{missed.length}</span>
          </div>
          <ul className="mt-2.5 flex flex-col gap-2">
            {missed.map(({ question }) => {
              const headword =
                question.direction === 'w2d' ? question.prompt : question.options[question.answer]!
              const definition =
                question.direction === 'w2d' ? question.options[question.answer]! : question.prompt
              return (
                <li key={question.word_id}>
                  <Link
                    to={`/learn?word=${question.word_id}`}
                    className="flex min-h-[60px] items-center gap-2.5 rounded-[18px] border border-line bg-card px-3 py-3"
                  >
                    <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[10px] bg-err-soft text-err">
                      <Icon name="cross" size={16} strokeWidth={3} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15.5px] leading-5 font-semibold text-ink">
                        {headword}
                      </span>
                      <span className="block text-[12.5px] leading-[17px] text-muted">
                        {definition}
                      </span>
                    </span>
                    <Icon name="chevronRight" size={16} strokeWidth={2.2} className="text-muted" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        {missed.length > 0 ? (
          <Link
            to={`/learn?word=${missed[0]!.question.word_id}`}
            className={buttonClass('primary', 'w-full !h-13 !rounded-lg text-base')}
          >
            Study {missed.length} missed word{missed.length === 1 ? '' : 's'}
          </Link>
        ) : (
          <Link to="/" className={buttonClass('primary', 'w-full !h-13 !rounded-lg text-base')}>
            Back to home
          </Link>
        )}
        <button
          type="button"
          onClick={onPlayAgain}
          className={buttonClass('secondary', 'w-full !border-line !text-ink')}
        >
          Quiz 10 more
        </button>
      </div>
    </div>
  )
}
