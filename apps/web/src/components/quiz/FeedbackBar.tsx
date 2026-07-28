import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

/**
 * The answer beat, docked under the question.
 *
 * The design replaces the old auto-advance timer with an explicit Continue:
 * nobody is rushed past the word they just got wrong, and Enter or Space moves
 * on when they are ready. Both states carry an icon and a word as well as a
 * colour, and the correct answer is spelled out either way.
 */
export function FeedbackBar({
  correct,
  headword,
  definition,
  combo,
  xpGain,
  isLast,
  onNext,
}: {
  correct: boolean
  headword: string
  definition: string
  combo: number
  xpGain: number
  isLast: boolean
  onNext: () => void
}) {
  return (
    <div
      role="status"
      className={`animate-rise fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 mx-auto max-w-md border-t-[1.5px] px-4 pt-3.5 pb-4 ${
        correct ? 'border-ok bg-ok-soft' : 'border-err bg-err-soft'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`animate-pop grid h-[26px] w-[26px] flex-none place-items-center rounded-full ${
            correct ? 'bg-ok text-on-ok' : 'bg-err text-on-err'
          }`}
        >
          <Icon name={correct ? 'check' : 'cross'} size={15} strokeWidth={3} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-base leading-[21px] font-bold ${correct ? 'text-ok' : 'text-err'}`}>
            {correct ? (combo >= 3 ? `Correct - x${combo} in a row` : 'Correct') : 'Not quite'}
          </p>
          <p className="text-[12.5px] leading-[17px] text-ink">
            {headword} - {definition}
          </p>
        </div>
        {correct ? (
          <span className="tabular flex-none text-[13px] font-bold text-xp">+{xpGain} XP</span>
        ) : null}
      </div>
      <Button
        full
        onClick={onNext}
        className={`mt-3 !h-13 !rounded-[15px] text-base ${
          correct ? '!bg-ok !text-on-ok' : '!bg-err !text-on-err'
        }`}
      >
        {isLast ? 'See results' : 'Continue'}
      </Button>
    </div>
  )
}
