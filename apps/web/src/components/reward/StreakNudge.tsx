import { Link } from 'react-router-dom'
import { buttonClass } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { Flame } from '../ui/Flame'
import { Icon } from '../ui/Icon'

/**
 * The streak-at-risk nudge. One a day, never after 9pm, and "Not tonight" is a
 * real full-width option rather than a greyed afterthought.
 *
 * The design's "Explicitly not doing" list is a requirement, not a suggestion:
 * no countdown, no loss framing, no second nudge in the same day, no guilt.
 */
export function StreakNudge({
  streak,
  goal,
  graceDay,
  onDismiss,
}: {
  streak: number
  goal: number
  graceDay: boolean
  onDismiss: () => void
}) {
  const day = streak + 1
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-3.5 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <div
        role="status"
        className="animate-rise-sheet rounded-2xl border-[1.5px] border-warn bg-card p-4.5 shadow-e3"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 flex-none place-items-center rounded-[18px] bg-warn-soft">
            <Flame tier="atRisk" size={30} />
          </span>
          <div className="flex-1">
            <Chip tone="warn" icon="alert" className="!h-[22px] !px-2.5 !text-[10.5px] uppercase">
              Streak at risk
            </Chip>
            <p className="mt-1.5 text-[19px] leading-6 font-bold tracking-[-0.015em] text-ink">
              Day {day} is still open
            </p>
          </div>
        </div>

        <p className="mt-3 text-[13.5px] leading-[19px] text-ink">
          One review keeps it. A full {goal} lights the flame - but one is enough, and nothing is
          lost if tonight isn&apos;t the night.
        </p>

        <div className="mt-3 flex gap-2">
          <div className="flex-1 rounded-lg border border-line bg-paper px-3 py-2.5">
            <div className="tabular text-sm leading-[18px] font-bold text-ink">1 review</div>
            <div className="text-[11px] leading-[15px] text-muted">keeps the run</div>
          </div>
          <div className="flex-1 rounded-lg border border-line bg-paper px-3 py-2.5">
            <div className="tabular text-sm leading-[18px] font-bold text-ink">{goal} reviews</div>
            <div className="text-[11px] leading-[15px] text-muted">lights day {day}</div>
          </div>
        </div>

        {graceDay ? (
          <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-accent-soft p-3">
            <Icon
              name="info"
              size={15}
              strokeWidth={2.2}
              className="mt-px flex-none text-accent-strong"
            />
            <p className="text-[11.5px] leading-4 text-accent-strong">
              Your last six days all hit goal, so a grace day would carry the run even if you skip -
              you would restart at day {day}, not day 1.
            </p>
          </div>
        ) : null}

        <Link
          to="/learn"
          onClick={onDismiss}
          className={buttonClass('flame', 'mt-3.5 w-full !h-13 !rounded-lg text-base')}
        >
          One quick review
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          className="tap mt-1.5 w-full rounded-lg text-sm font-semibold text-muted"
        >
          Not tonight
        </button>
      </div>
    </div>
  )
}
