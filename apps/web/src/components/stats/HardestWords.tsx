import type { StatsDto } from '@vocab/shared'
import { Link } from 'react-router-dom'
import { Icon } from '../ui/Icon'

/**
 * The words winning. Each row is a challenge rather than a table cell, and each
 * one links straight into Learn at that word.
 */
export function HardestWords({ hardest }: { hardest: StatsDto['hardest'] }) {
  if (hardest.length === 0) {
    return (
      <p className="text-[13px] leading-[18px] text-muted">
        Nothing yet - miss a word a few times and it shows up here.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {hardest.map((w) => {
        const rate = Math.round(w.miss_rate * 100)
        return (
          <li key={w.word_id}>
            <Link
              to={`/learn?word=${w.word_id}`}
              className="flex min-h-16 items-center gap-3 rounded-[18px] border border-line bg-card px-3 py-3 shadow-e1"
            >
              <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[13px] bg-err-soft">
                <span className="tabular text-[12.5px] font-extrabold text-err">{rate}%</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15.5px] leading-5 font-semibold text-ink">
                  {w.headword}
                </span>
                <span className="tabular block text-xs leading-4 text-muted">
                  {w.misses} misses in {w.attempts} attempts
                </span>
                <span className="mt-1.5 block h-[5px] overflow-hidden rounded-full bg-line">
                  <span className="block h-full rounded-full bg-err" style={{ width: `${rate}%` }} />
                </span>
              </span>
              <span className="flex flex-none flex-col items-end gap-0.5">
                <span className="text-[11px] leading-none font-bold text-accent-strong">
                  Beat it
                </span>
                <Icon name="chevronRight" size={16} strokeWidth={2.2} className="text-muted" />
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
