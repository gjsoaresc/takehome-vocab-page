import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ErrorState, StatsSkeleton, useMinimumDuration } from '../components/States'
import { BadgeGrid } from '../components/reward/BadgeGrid'
import { HardestWords } from '../components/stats/HardestWords'
import { MasteryChart } from '../components/stats/MasteryChart'
import { MasteryHero } from '../components/stats/MasteryHero'
import { ModeAccuracy } from '../components/stats/ModeAccuracy'
import { buttonClass } from '../components/ui/Button'
import { CARD } from '../components/ui/Card'
import { Icon, type IconName } from '../components/ui/Icon'
import { api } from '../lib/api'
import { getBestRun, getStoredGoal, getXpFloor } from '../lib/reward-store'
import { MILESTONES, deriveRewards } from '../lib/rewards'
import { useUserId } from '../lib/user-context'

const FIRST_STEPS: Array<{ to: string; name: string; sub: string; icon: IconName; tile: string }> = [
  {
    to: '/learn',
    name: 'Learn',
    sub: 'Browse and rate - fills mastery',
    icon: 'learn',
    tile: 'bg-accent-soft text-accent',
  },
  {
    to: '/quiz',
    name: 'Quiz',
    sub: 'Fills accuracy by mode',
    icon: 'quiz',
    tile: 'bg-xp-soft text-xp',
  },
  {
    to: '/matching',
    name: 'Matching',
    sub: 'Fills accuracy by mode',
    icon: 'match',
    tile: 'bg-gold-soft text-gold',
  },
  {
    to: '/game',
    name: 'Word Rush',
    sub: 'Fills your daily review count',
    icon: 'rush',
    tile: 'bg-flame-soft text-flame',
  },
]

function FreshCase() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl leading-8 font-bold tracking-[-0.025em] text-ink">
          Nothing in the case
          <br />
          yet
        </h1>
        <p className="mt-2 text-[13.5px] leading-[19px] text-muted">
          Your first session fills all of this in - mastery, streak, accuracy, badges.
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-line bg-card px-4 py-4.5">
        <div className="h-3.5 rounded-full bg-line" />
        <div className="mt-2 flex justify-between">
          {MILESTONES.map((m) => (
            <span key={m} className="tabular text-[10.5px] leading-[14px] font-semibold text-muted">
              {m.toLocaleString('en-US')}
            </span>
          ))}
        </div>
        <p className="mt-3 text-center text-xs leading-4 text-muted">
          First milestone: 100 words mastered
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {FIRST_STEPS.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className={`${CARD} flex min-h-14 items-center gap-3 rounded-[18px] px-3.5 py-3`}
          >
            <span className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-[13px] ${s.tile}`}>
              <Icon name={s.icon} size={20} />
            </span>
            <span className="flex-1">
              <span className="block text-[14.5px] leading-5 font-semibold text-ink">{s.name}</span>
              <span className="block text-xs leading-4 text-muted">{s.sub}</span>
            </span>
            <Icon name="chevronRight" size={16} strokeWidth={2.2} className="text-muted" />
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function Stats() {
  const userId = useUserId()
  const statsQuery = useQuery({
    queryKey: ['stats', userId],
    queryFn: () => api.stats(userId),
    staleTime: 10_000,
  })
  const showSkeleton = useMinimumDuration(statsQuery.isLoading)

  const stats = statsQuery.data
  const reward = useMemo(
    () =>
      stats
        ? deriveRewards(stats, {
            xpFloor: getXpFloor(),
            storedGoal: getStoredGoal(),
            bestRunScore: getBestRun(),
          })
        : null,
    [stats],
  )

  if (showSkeleton) return <StatsSkeleton />
  if (statsQuery.isError || !stats || !reward)
    return (
      <div className="flex flex-col gap-3.5">
        <ErrorState
          title="Progress didn't load"
          message="The dashboard needs one request and it failed. Your practice history is safe."
          onRetry={() => void statsQuery.refetch()}
          altLabel="Keep studying"
          onAlt={() => void statsQuery.refetch()}
        />
        <Link to="/learn" className={buttonClass('secondary', 'w-full !border-line !text-ink')}>
          Keep studying anyway
        </Link>
      </div>
    )

  if (reward.seen === 0) return <FreshCase />

  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <h1 className="text-[26px] leading-[30px] font-bold tracking-[-0.025em] text-ink">
          Your case
        </h1>
        <p className="text-[12.5px] leading-[17px] text-muted">Everything you have earned so far</p>
      </div>

      <MasteryHero mastered={reward.mastered} seen={reward.seen} levelTitle={reward.levelTitle} />

      <section className={`${CARD} p-4`}>
        <MasteryChart data={stats.mastery_over_time} streak={reward.streak} />
      </section>

      <section className={`${CARD} p-4`}>
        <h2 className="text-[11px] leading-none font-semibold tracking-[0.08em] text-muted uppercase">
          Accuracy by mode
        </h2>
        <div className="mt-3.5">
          <ModeAccuracy modes={stats.modes} />
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between px-0.5">
          <h2 className="text-[11px] leading-none font-semibold tracking-[0.08em] text-muted uppercase">
            Words beating you
          </h2>
          {stats.hardest.length > 0 ? (
            <Link
              to={`/learn?word=${stats.hardest[0]!.word_id}`}
              className="text-xs font-semibold text-accent-strong"
            >
              Study all
            </Link>
          ) : null}
        </div>
        <div className="mt-2.5">
          <HardestWords hardest={stats.hardest} />
        </div>
      </section>

      <section className={`${CARD} px-4 pt-3.5 pb-4`}>
        <BadgeGrid badges={reward.badges} />
      </section>
    </div>
  )
}
