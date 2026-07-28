import { MILESTONES, WORD_COUNT } from '../../lib/rewards'
import { group } from '../ui/CountUp'
import { Icon } from '../ui/Icon'

/**
 * Mastered out of the whole corpus, with the milestone track underneath.
 * The denominator is 991, the real parse count - not the design's round 1,000.
 */
export function MasteryHero({
  mastered,
  seen,
  levelTitle,
}: {
  mastered: number
  seen: number
  levelTitle: string
}) {
  const pct = Math.min(1, mastered / WORD_COUNT)
  const next = MILESTONES.find((m) => mastered < m) ?? null

  return (
    <div className="celebrate rounded-2xl p-[1.5px]">
      <div className="rounded-[26.5px] bg-card px-4 pt-4.5 pb-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10.5px] leading-none font-semibold tracking-[0.09em] text-muted uppercase">
              Mastered
            </p>
            <p className="mt-1.5 flex items-baseline gap-1">
              <span className="tabular text-[44px] leading-[44px] font-extrabold tracking-[-0.035em] text-ink">
                {group(mastered)}
              </span>
              <span className="text-base leading-none font-semibold text-muted">
                / {group(WORD_COUNT)}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="tabular text-[15px] leading-none font-bold text-accent-strong">
              {group(seen)}
            </p>
            <p className="text-[10.5px] leading-[14px] font-medium text-muted">words seen</p>
          </div>
        </div>

        <div className="relative mt-4.5 h-13">
          <div className="h-3.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-[900ms] ease-standard"
              style={{ width: `${pct * 100}%` }}
            />
          </div>
          {MILESTONES.map((m, i) => {
            const reached = mastered >= m
            const left = (m / WORD_COUNT) * 100
            return (
              <div
                key={m}
                className="absolute top-[-4px] flex flex-col items-center gap-1.5"
                style={{
                  left: `${left}%`,
                  transform:
                    i === 0
                      ? 'translateX(-8px)'
                      : m === WORD_COUNT
                        ? 'translateX(-100%)'
                        : 'translateX(-50%)',
                }}
              >
                <span
                  className={`grid h-[22px] w-[22px] place-items-center rounded-lg border-2 border-card shadow-e1 ${
                    reached ? 'bg-accent text-on-accent' : 'bg-card text-muted'
                  }`}
                >
                  <Icon name={reached ? 'check' : 'lock'} size={12} strokeWidth={3.2} />
                </span>
                <span
                  className={`tabular text-[10.5px] leading-[14px] font-semibold whitespace-nowrap ${
                    reached ? 'text-accent-strong' : 'text-muted'
                  }`}
                >
                  {group(m)}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
          <Icon name="trophy" size={16} strokeWidth={2.2} className="flex-none text-gold" />
          <p className="text-[12.5px] leading-[17px] text-ink">
            {next === null
              ? `Every one of the ${group(WORD_COUNT)} words mastered. Nothing left to unlock.`
              : `${group(next - mastered)} more to the next milestone - ${group(next)} mastered`}
          </p>
          <span className="ml-auto flex-none text-[11px] font-semibold text-muted">
            {levelTitle}
          </span>
        </div>
      </div>
    </div>
  )
}
