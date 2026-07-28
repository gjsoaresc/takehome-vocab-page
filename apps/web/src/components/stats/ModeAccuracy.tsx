import type { StatsDto } from '@vocab/shared'
import { useInView } from '../../lib/motion'
import { ProgressBar } from '../ui/Progress'

/** Gap between one bar starting to grow and the next. */
const STAGGER_MS = 90

const MODE_LABEL: Record<string, string> = {
  learn: 'Learn',
  quiz: 'Quiz',
  matching: 'Matching',
  game: 'Word Rush',
}

/**
 * Accuracy by mode. Value is carried by bar length AND by the number beside
 * it - the bars are a single hue on purpose, so nothing is encoded in colour.
 */
export function ModeAccuracy({ modes }: { modes: StatsDto['modes'] }) {
  // Called before the early return: hooks cannot sit behind a condition.
  const [ref, inView] = useInView<HTMLDivElement>()

  if (modes.length === 0) {
    return <p className="text-[13px] text-muted">No answers recorded yet.</p>
  }

  const weakest = [...modes].sort((a, b) => a.correct / a.attempts - b.correct / b.attempts)[0]!
  const pct = (m: StatsDto['modes'][number]) => Math.round((m.correct / m.attempts) * 100)

  return (
    <div ref={ref}>
      <div className="flex flex-col gap-3">
        {modes.map((m, i) => (
          <div key={m.mode}>
            <div className="flex items-baseline justify-between gap-2.5">
              <span className="text-[13.5px] leading-[18px] font-semibold text-ink">
                {MODE_LABEL[m.mode] ?? m.mode}
              </span>
              <span className="tabular text-[11px] leading-4 text-muted">
                {m.correct.toLocaleString('en-US')} of {m.attempts.toLocaleString('en-US')}
              </span>
              <span className="tabular min-w-[42px] text-right text-sm leading-[18px] font-bold text-ink">
                {pct(m)}%
              </span>
            </div>
            {/* Grown by ProgressBar's own width transition once the card
                scrolls in - the number beside it already states the value, so
                a bar still at zero would be the only thing lying. */}
            <ProgressBar
              value={inView ? m.correct / m.attempts : 0}
              delayMs={i * STAGGER_MS}
              className="mt-1.5"
              label={`${MODE_LABEL[m.mode] ?? m.mode} accuracy`}
            />
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-[1.5] text-muted">
        {MODE_LABEL[weakest.mode] ?? weakest.mode} is your weakest at {pct(weakest)}% - the bar
        length and the number say it, not the colour.
      </p>
    </div>
  )
}
