interface DayPoint {
  day: string
  mastered: number
  reviews: number
}

/** Last-30-days mastery bar chart: single series, single hue, thin marks. */
export function MasteryChart({ data }: { data: DayPoint[] }) {
  // Fill missing days so spacing stays even.
  const byDay = new Map(data.map((d) => [d.day, d]))
  const days: DayPoint[] = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000)
    const key = d.toISOString().slice(0, 10)
    days.push(byDay.get(key) ?? { day: key, mastered: 0, reviews: 0 })
  }
  const max = Math.max(1, ...days.map((d) => d.mastered))
  const W = 360
  const H = 110
  const plotH = 84
  const gap = 2
  const barW = (W - gap * 29) / 30

  const label = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`)
    return `${d.toLocaleString('en', { month: 'short', timeZone: 'UTC' })} ${d.getUTCDate()}`
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={`Words mastered per day over the last 30 days, peaking at ${max}`}
    >
      {days.map((d, i) => {
        const h = d.mastered === 0 ? 2 : Math.max(4, (d.mastered / max) * plotH)
        const x = i * (barW + gap)
        return (
          <rect
            key={d.day}
            x={x}
            y={plotH - h}
            width={barW}
            height={h}
            rx={2}
            fill={d.mastered === 0 ? 'var(--color-line)' : 'var(--color-accent)'}
          >
            <title>{`${label(d.day)}: ${d.mastered} mastered, ${d.reviews} reviews`}</title>
          </rect>
        )
      })}
      <text x={0} y={H - 8} fontSize={11} fill="var(--color-muted)">
        {label(days[0]!.day)}
      </text>
      <text x={W} y={H - 8} fontSize={11} fill="var(--color-muted)" textAnchor="end">
        {label(days[days.length - 1]!.day)}
      </text>
    </svg>
  )
}
