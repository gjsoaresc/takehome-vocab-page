import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { HardestWords } from '../components/stats/HardestWords'
import { MasteryChart } from '../components/stats/MasteryChart'
import { ModeAccuracy } from '../components/stats/ModeAccuracy'
import { api } from '../lib/api'
import { useUserId } from '../lib/user-context'

export default function Stats() {
  const userId = useUserId()
  const statsQuery = useQuery({
    queryKey: ['stats', userId],
    queryFn: () => api.stats(userId),
    staleTime: 10_000,
  })

  if (statsQuery.isLoading) return <LoadingState label="Crunching your numbers" />
  if (statsQuery.isError)
    return (
      <ErrorState message="Could not load stats." onRetry={() => void statsQuery.refetch()} />
    )

  const stats = statsQuery.data!
  const hasActivity = stats.modes.length > 0 || stats.totals.words_seen > 0

  if (!hasActivity) {
    return (
      <EmptyState
        title="No study history yet"
        hint="Play any mode and your progress lands here - mastery over time, streaks, and the words that fight back."
        action={
          <Link
            to="/learn"
            className="tap flex items-center rounded-lg bg-accent px-5 font-medium text-white"
          >
            Start learning
          </Link>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Progress</h1>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-line bg-card p-3 text-center">
          <p className="text-2xl font-bold tabular-nums">{stats.streak}</p>
          <p className="text-xs text-muted">day streak</p>
        </div>
        <div className="rounded-xl border border-line bg-card p-3 text-center">
          <p className="text-2xl font-bold tabular-nums">{stats.totals.words_mastered}</p>
          <p className="text-xs text-muted">mastered</p>
        </div>
        <div className="rounded-xl border border-line bg-card p-3 text-center">
          <p className="text-2xl font-bold tabular-nums">{stats.totals.words_seen}</p>
          <p className="text-xs text-muted">words seen</p>
        </div>
      </div>

      <section className="rounded-xl border border-line bg-card p-4">
        <h2 className="font-semibold">Mastered per day</h2>
        <p className="text-xs text-muted">Last 30 days</p>
        <div className="mt-3">
          <MasteryChart data={stats.mastery_over_time} />
        </div>
      </section>

      <section className="rounded-xl border border-line bg-card p-4">
        <h2 className="font-semibold">Accuracy by mode</h2>
        <div className="mt-3">
          <ModeAccuracy modes={stats.modes} />
        </div>
      </section>

      <section className="rounded-xl border border-line bg-card">
        <h2 className="px-4 pt-4 font-semibold">Hardest words</h2>
        <p className="px-4 pb-2 text-xs text-muted">
          Missed most often - the scheduler brings these back sooner.
        </p>
        <HardestWords hardest={stats.hardest} />
      </section>
    </div>
  )
}
