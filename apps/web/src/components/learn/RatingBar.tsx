/** Self-rating after a reveal; ratings map to SM-2 quality (1/3/4/5). */
export const RATINGS = [
  { rating: 1, label: 'Again', key: '1', className: 'bg-err-soft text-err' },
  { rating: 3, label: 'Hard', key: '2', className: 'bg-warn-soft text-ink' },
  { rating: 4, label: 'Good', key: '3', className: 'bg-accent-soft text-accent-strong' },
  { rating: 5, label: 'Easy', key: '4', className: 'bg-ok-soft text-ok' },
] as const

export function RatingBar({ onRate }: { onRate: (rating: number) => void }) {
  return (
    <div role="group" aria-label="How well did you know it?" className="flex gap-2">
      {RATINGS.map((r) => (
        <button
          key={r.rating}
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRate(r.rating)
          }}
          className={`tap flex-1 rounded-lg text-sm font-semibold active:opacity-80 ${r.className}`}
        >
          {r.label}
          <span className="ml-1 hidden text-xs opacity-60 sm:inline">{r.key}</span>
        </button>
      ))}
    </div>
  )
}
