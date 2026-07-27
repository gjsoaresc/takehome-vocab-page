import type { StatsDto } from '@vocab/shared'

const MODE_LABEL: Record<string, string> = {
  learn: 'Learn',
  quiz: 'Quiz',
  matching: 'Matching',
  game: 'Word Rush',
}

/** Accuracy and attempts by mode: labeled single-hue bars, numbers in ink. */
export function ModeAccuracy({ modes }: { modes: StatsDto['modes'] }) {
  return (
    <div className="flex flex-col gap-3">
      {modes.map((m) => (
        <div key={m.mode}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold">{MODE_LABEL[m.mode] ?? m.mode}</span>
            <span className="text-muted">
              {Math.round(m.accuracy * 100)}% of {m.attempts.toLocaleString('en-US')} answers
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.round(m.accuracy * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
