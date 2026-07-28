/** Self-rating after a reveal; ratings map to SM-2 quality (1/3/4/5). */
export const RATINGS = [
  { rating: 1, label: 'Again', key: '1', className: 'bg-err-soft border-err text-err' },
  { rating: 3, label: 'Hard', key: '2', className: 'bg-warn-soft border-warn/45 text-warn' },
  {
    rating: 4,
    label: 'Good',
    key: '3',
    className: 'bg-accent-soft border-accent/45 text-accent-strong',
  },
  { rating: 5, label: 'Easy', key: '4', className: 'bg-transparent border-line text-muted' },
] as const

/**
 * Four 44px targets in an unmistakable ranking. Disabled until the meaning is
 * revealed - rating a word you have not looked at is not a rating.
 */
export function RatingBar({
  onRate,
  disabled,
}: {
  onRate: (rating: number) => void
  disabled: boolean
}) {
  return (
    <div>
      <div
        role="group"
        aria-label="How well did you know it?"
        className={`flex gap-2 transition-opacity duration-[160ms] ${disabled ? 'opacity-40' : 'opacity-100'}`}
      >
        {RATINGS.map((r) => (
          <button
            key={r.rating}
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation()
              onRate(r.rating)
            }}
            className={`tap flex flex-1 flex-col items-center justify-center rounded-[14px] border-[1.5px] text-sm font-semibold transition-transform duration-[90ms] ease-standard active:scale-[0.97] ${r.className}`}
          >
            {r.label}
            <span className="hidden font-mono text-[10px] opacity-60 sm:block">{r.key}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-[11.5px] text-muted">
        {disabled ? 'Reveal first - then rate' : 'Honest ratings shorten the queue faster'}
      </p>
    </div>
  )
}
