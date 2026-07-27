import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useUserId } from '../lib/user-context'

const MODES = [
  {
    to: '/learn',
    title: 'Learn',
    blurb: 'Browse all 1,000 words, reveal and rate',
  },
  { to: '/quiz', title: 'Quiz', blurb: 'Multiple choice, both directions' },
  { to: '/matching', title: 'Matching', blurb: 'Pair words with definitions' },
  { to: '/game', title: 'Word Rush', blurb: '90 seconds, one thumb, no mercy' },
] as const

export function Home() {
  const userId = useUserId()
  const stats = useQuery({ queryKey: ['stats', userId], queryFn: () => api.stats(userId) })

  const streak = stats.data?.streak ?? 0
  const mastered = stats.data?.totals.words_mastered ?? 0

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold">SAT Vocab</h1>
          <p className="text-sm text-muted">Spaced repetition for the 1,000 most common words</p>
        </div>
      </header>

      <div className="flex gap-2" aria-live="polite">
        <span className="rounded-full bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent-strong">
          {stats.isLoading ? 'Streak ...' : `Streak: ${streak} day${streak === 1 ? '' : 's'}`}
        </span>
        <span className="rounded-full bg-ok-soft px-3 py-1.5 text-sm font-semibold text-ok">
          {stats.isLoading ? 'Mastered ...' : `Mastered: ${mastered}`}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {MODES.map((mode) => (
          <Link
            key={mode.to}
            to={mode.to}
            aria-label={`${mode.title}: ${mode.blurb}`}
            className="tap rounded-xl border border-line bg-card p-4 active:border-accent"
          >
            <p className="text-lg font-bold">{mode.title}</p>
            <p className="text-sm text-muted">{mode.blurb}</p>
          </Link>
        ))}
      </div>

      <Link
        to="/stats"
        aria-label="Progress: mastery over time, hardest words, accuracy"
        className="tap flex items-center justify-between rounded-xl border border-line bg-card p-4 active:border-accent"
      >
        <div>
          <p className="text-lg font-bold">Progress</p>
          <p className="text-sm text-muted">Mastery over time, hardest words, accuracy</p>
        </div>
        <span aria-hidden className="text-xl text-muted">
          &rsaquo;
        </span>
      </Link>
    </div>
  )
}
