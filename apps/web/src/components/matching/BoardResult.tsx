import { Link } from 'react-router-dom'
import { buttonClass } from '../ui/Button'
import { CountUp } from '../ui/CountUp'
import { Icon } from '../ui/Icon'
import { ProgressRing } from '../ui/Progress'

export const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

/**
 * Board cleared. Accuracy is pairs over moves, so a clean board is 100% however
 * long it took - the timer feeds the record line, never the score, because
 * nothing here should push anyone into guessing.
 */
export function BoardResult({
  pairs,
  moves,
  seconds,
  xpEarned,
  record,
  isRecord,
  onAgain,
}: {
  pairs: number
  moves: number
  seconds: number
  xpEarned: number
  record: { seconds: number; accuracy: number } | null
  isRecord: boolean
  onAgain: () => void
}) {
  const accuracy = moves === 0 ? 1 : pairs / moves
  const clean = moves === pairs

  return (
    <div className="flex flex-col gap-4">
      <div className={isRecord ? 'celebrate rounded-2xl p-[1.5px]' : ''}>
        <div
          className={`flex flex-col items-center rounded-[26.5px] bg-card px-4 pt-6 pb-5 ${
            isRecord ? '' : 'border border-line'
          }`}
        >
          {isRecord ? (
            <span className="celebrate inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[11.5px] leading-none font-bold tracking-[0.06em] text-white uppercase">
              <Icon name="star" size={14} filled />
              New board record
            </span>
          ) : null}

          <ProgressRing
            value={accuracy}
            size={150}
            stroke={13}
            tone={clean ? 'gold' : accuracy >= 0.75 ? 'ok' : 'accent'}
            className="mt-3"
            label={`${Math.round(accuracy * 100)} percent accuracy`}
          >
            <span className="tabular text-[38px] leading-10 font-bold tracking-[-0.03em] text-ink">
              {Math.round(accuracy * 100)}%
            </span>
            <span className="text-xs leading-none font-semibold text-muted">accuracy</span>
          </ProgressRing>

          <h1 className="mt-3 text-center text-lg font-bold tracking-[-0.02em] text-ink">
            {clean ? 'Clean board' : 'Board cleared'}
          </h1>
          <p className="mt-0.5 max-w-[280px] text-center text-[13.5px] leading-[19px] text-muted">
            {clean
              ? `${pairs} pairs, ${moves} moves, no misses.`
              : `${moves} moves for ${pairs} pairs - the misses are the ones worth re-reading.`}
          </p>

          <div className="mt-4 flex w-full gap-2">
            <div className="flex-1 rounded-lg bg-accent-soft px-2 py-2.5 text-center">
              <div className="tabular text-[17px] leading-[22px] font-bold text-accent-strong">
                {clock(seconds)}
              </div>
              <div className="text-[10.5px] leading-[14px] font-medium text-muted">time</div>
            </div>
            <div className="flex-1 rounded-lg bg-xp-soft px-2 py-2.5 text-center">
              <div className="text-[17px] leading-[22px] font-bold text-xp">
                <CountUp to={xpEarned} prefix="+" />
              </div>
              <div className="text-[10.5px] leading-[14px] font-medium text-muted">XP earned</div>
            </div>
            <div className="flex-1 rounded-lg bg-flame-soft px-2 py-2.5 text-center">
              <div className="tabular text-[17px] leading-[22px] font-bold text-flame">{moves}</div>
              <div className="text-[10.5px] leading-[14px] font-medium text-muted">moves</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 rounded-[18px] border border-line bg-card px-3.5 py-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-[13px] bg-gold-soft text-gold">
          <Icon name="trophy" size={21} />
        </span>
        <div>
          <p className="text-[13.5px] leading-[18px] font-semibold text-ink">
            Best board -{' '}
            {record ? `${clock(record.seconds)} - ${Math.round(record.accuracy * 100)}%` : 'not set'}
          </p>
          <p className="text-xs leading-4 text-muted">
            {isRecord ? 'You just beat it - new best saved on this device' : 'Fastest clean board'}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onAgain}
          className={buttonClass('primary', 'w-full !h-13 !rounded-lg text-base')}
        >
          Play again
        </button>
        <Link to="/" className={buttonClass('secondary', 'w-full !border-line !text-ink')}>
          Back to home
        </Link>
      </div>
    </div>
  )
}
