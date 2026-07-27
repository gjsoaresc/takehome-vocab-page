import type { StatsDto } from '@vocab/shared'
import { Link } from 'react-router-dom'

/** The words missed most often, by miss rate; each row jumps into Learn. */
export function HardestWords({ hardest }: { hardest: StatsDto['hardest'] }) {
  if (hardest.length === 0) {
    return (
      <p className="px-4 py-4 text-sm text-muted">
        Nothing yet - miss a word a few times and it shows up here.
      </p>
    )
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs text-muted">
          <th className="px-4 py-2 font-semibold">Word</th>
          <th className="px-2 py-2 text-right font-semibold">Miss rate</th>
          <th className="px-4 py-2 text-right font-semibold">Attempts</th>
        </tr>
      </thead>
      <tbody>
        {hardest.map((w) => (
          <tr key={w.word_id} className="border-b border-line last:border-b-0">
            <td className="px-2 py-1">
              <Link to={`/learn?word=${w.word_id}`} className="tap flex items-center px-2 font-semibold">
                {w.headword}
              </Link>
            </td>
            <td className="px-2 py-1 text-right tabular-nums">
              {Math.round(w.miss_rate * 100)}%
            </td>
            <td className="px-4 py-1 text-right tabular-nums text-muted">{w.attempts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
