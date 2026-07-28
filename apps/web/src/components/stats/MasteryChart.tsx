import { Icon } from '../ui/Icon'
import { group } from '../ui/CountUp'

interface DayPoint {
  day: string
  mastered: number
  reviews: number
  correct: number
}

/** The UTC day key N days before today, matching the API's `day` field. */
function utcDayKey(daysAgo: number): string {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo),
  )
    .toISOString()
    .slice(0, 10)
}

const label = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`)
  return `${d.toLocaleString('en', { month: 'short', timeZone: 'UTC' })} ${d.getUTCDate()}`
}

/**
 * Thirty days of activity as bars, with the current streak run tinted flame and
 * underlined so the streak is visible inside the chart rather than only beside it.
 *
 * The window is built from UTC dates, matching the `day` values the API returns.
 * It used to be built from the local clock while labelled UTC, which shifted the
 * whole strip by a day for anyone behind UTC.
 */
export function MasteryChart({ data, streak }: { data: DayPoint[]; streak: number }) {
  const byDay = new Map(data.map((d) => [d.day, d]))
  const days: DayPoint[] = []
  for (let i = 29; i >= 0; i--) {
    const key = utcDayKey(i)
    days.push(byDay.get(key) ?? { day: key, mastered: 0, reviews: 0, correct: 0 })
  }

  const maxReviews = Math.max(1, ...days.map((d) => d.reviews))
  // Scale against the 90th percentile of active days, not the outright max: a
  // single heavy session (a 130-judgment Word Rush run) otherwise flattens
  // every other bar to the 3px floor and the month reads as empty. The outlier
  // still draws at full height, it just stops setting the scale.
  const active = days.filter((d) => d.reviews > 0).map((d) => d.reviews).sort((a, b) => a - b)
  const scale = Math.max(1, active[Math.floor(active.length * 0.9)] ?? maxReviews)
  const streakFrom = days.length - streak
  const totalReviews = days.reduce((a, d) => a + d.reviews, 0)
  const totalCorrect = days.reduce((a, d) => a + d.correct, 0)
  const activeDays = days.filter((d) => d.reviews > 0).length

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] leading-none font-semibold tracking-[0.08em] text-muted uppercase">
          Last 30 days
        </span>
        {streak > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <Icon name="flame" size={13} filled className="text-flame" />
            <span className="tabular text-xs leading-none font-bold text-flame">
              {streak}-day streak
            </span>
          </span>
        ) : null}
      </div>

      <div
        className="mt-3.5 flex h-[66px] items-end gap-1"
        role="img"
        aria-label={`Reviews per day over the last 30 days, peaking at ${maxReviews}${
          streak > 0 ? `, with a ${streak}-day streak running to today` : ''
        }`}
      >
        {days.map((d, i) => {
          const inStreak = streak > 0 && i >= streakFrom
          const height =
            d.reviews === 0 ? 3 : Math.min(58, Math.max(6, Math.round((d.reviews / scale) * 58)))
          return (
            <div key={d.day} className="flex h-full flex-1 flex-col justify-end" title={`${label(d.day)}: ${d.reviews} reviews, ${d.mastered} mastered`}>
              <div
                className={`animate-grow-bar w-full origin-bottom rounded-[3px] ${
                  d.reviews === 0
                    ? 'bg-line'
                    : inStreak
                      ? 'bg-flame'
                      : d.reviews >= scale * 0.6
                        ? 'bg-accent'
                        : 'bg-accent-soft'
                }`}
                style={{ height }}
              />
            </div>
          )
        })}
      </div>

      <div className="mt-1 flex gap-1" aria-hidden>
        {days.map((d, i) => (
          <div
            key={d.day}
            className={`h-[3px] flex-1 rounded-sm ${
              streak > 0 && i >= streakFrom ? 'bg-flame' : 'bg-transparent'
            }`}
          />
        ))}
      </div>

      <div className="mt-2 flex justify-between text-[10.5px] leading-none">
        <span className="text-muted">{label(days[0]!.day)}</span>
        {streak > 0 ? (
          <span className="font-semibold text-flame">last {streak} days unbroken</span>
        ) : null}
        <span className="text-muted">today</span>
      </div>

      <div className="mt-3 flex gap-3.5 border-t border-line pt-3">
        <div className="flex-1">
          <div className="tabular text-[15.5px] leading-5 font-bold text-ink">
            {group(totalReviews)}
          </div>
          <div className="text-[10.5px] leading-[14px] font-medium text-muted">
            reviews in 30 days
          </div>
        </div>
        <div className="flex-1">
          <div className="tabular text-[15.5px] leading-5 font-bold text-ok">
            {totalReviews === 0 ? '-' : `${Math.round((totalCorrect / totalReviews) * 100)}%`}
          </div>
          <div className="text-[10.5px] leading-[14px] font-medium text-muted">correct overall</div>
        </div>
        <div className="flex-1">
          <div className="tabular text-[15.5px] leading-5 font-bold text-flame">
            {activeDays} / 30
          </div>
          <div className="text-[10.5px] leading-[14px] font-medium text-muted">days practised</div>
        </div>
      </div>
    </div>
  )
}
