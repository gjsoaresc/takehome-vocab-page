import { useQuery } from '@tanstack/react-query'
import type { StatsDto } from '@vocab/shared'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorState, HomeSkeleton, useMinimumDuration } from '../components/States'
import { GoalRing } from '../components/home/GoalRing'
import { LevelStrip } from '../components/home/LevelStrip'
import { ModeCard, SuggestedModeCard, type Mode } from '../components/home/ModeCard'
import { BADGE_ICON } from '../components/reward/BadgeSheet'
import { StreakNudge } from '../components/reward/StreakNudge'
import { buttonClass } from '../components/ui/Button'
import { CARD, SectionLabel } from '../components/ui/Card'
import { Icon } from '../components/ui/Icon'
import { api } from '../lib/api'
import { useCelebrate } from '../lib/celebrate'
import { clockTime, useNow, weekday } from '../lib/clock'
import { getBestRun, getStoredGoal, getXpFloor, rememberXp } from '../lib/reward-store'
import { WORD_COUNT, deriveRewards, formatProgress, type Badge } from '../lib/rewards'
import { useUserId } from '../lib/user-context'

const NUDGE_KEY = 'vocab.reward.nudge_day'

/** Mode copy is fixed; only the trailing stat comes from the payload. */
const MODES = {
  learn: {
    to: '/learn',
    name: 'Learn',
    sub: 'Browse and rate, one word at a time',
    icon: 'learn',
    tone: 'accent',
  },
  quiz: {
    to: '/quiz',
    name: 'Quiz',
    sub: 'Multiple choice, both directions',
    icon: 'quiz',
    tone: 'xp',
  },
  matching: {
    to: '/matching',
    name: 'Matching',
    sub: 'Pair words with definitions',
    icon: 'match',
    tone: 'gold',
  },
  game: {
    to: '/game',
    name: 'Word Rush',
    sub: '90 seconds, one thumb, no mercy',
    icon: 'rush',
    tone: 'flame',
  },
} as const

type ModeKey = keyof typeof MODES

const pct = (m: { attempts: number; correct: number }) =>
  m.attempts === 0 ? 0 : Math.round((m.correct / m.attempts) * 100)

/**
 * Which mode to nudge towards. One deterministic rule, not a heuristic pile:
 * the weakest of the three graded modes once it has enough attempts to mean
 * anything, otherwise Learn.
 *
 * `learn` is excluded on purpose even though it does appear in modes[]: its
 * "accuracy" is the share of self-ratings at Good or better, which is not
 * comparable to getting an answer right.
 */
function suggestedMode(stats: StatsDto): ModeKey {
  const graded = stats.modes.filter((m) => m.mode !== 'learn' && m.attempts >= 20)
  if (graded.length === 0) return 'learn'
  return graded.reduce((a, b) => (pct(a) <= pct(b) ? a : b)).mode as ModeKey
}

function statFor(key: ModeKey, stats: StatsDto): string {
  if (key === 'learn') {
    const left = WORD_COUNT - stats.totals.words_seen
    return left > 0 ? `${left.toLocaleString('en-US')} not seen yet` : 'Every word seen'
  }
  const m = stats.modes.find((x) => x.mode === key)
  if (!m || m.attempts === 0) return 'Not tried yet'
  return `${pct(m)}% accuracy - ${m.attempts.toLocaleString('en-US')} attempts`
}

function BadgeRow({ badges, nextBadge }: { badges: Badge[]; nextBadge: Badge | null }) {
  const earned = badges.filter((b) => b.earned)
  return (
    <section className={`${CARD} px-4 pt-3.5 pb-4`} aria-label="Badges">
      <div className="flex items-baseline justify-between">
        <SectionLabel>Badges</SectionLabel>
        <Link to="/stats" className="tabular text-xs font-semibold text-accent-strong">
          {earned.length} of {badges.length}
        </Link>
      </div>
      <div className="mt-3 flex items-start gap-3">
        {earned.slice(-4).map((b) => (
          <div key={b.id} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span className="grid h-12 w-12 place-items-center rounded-lg border border-gold/30 bg-gold-soft text-gold">
              <Icon name={BADGE_ICON[b.id] ?? 'star'} size={24} />
            </span>
            <span className="text-center text-[10px] leading-[13px] font-semibold text-ink">
              {b.name}
            </span>
          </div>
        ))}
        {nextBadge ? (
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span className="grid h-12 w-12 place-items-center rounded-lg border border-dashed border-line bg-paper text-muted">
              <Icon name="lock" size={22} />
            </span>
            <span className="text-center text-[10px] leading-[13px] font-semibold text-muted">
              {nextBadge.name}
            </span>
          </div>
        ) : null}
      </div>
      {nextBadge ? (
        <p className="tabular mt-3 border-t border-line pt-3 font-mono text-[11px] text-muted">
          Next: {nextBadge.condition} - {formatProgress(nextBadge.progress)}
        </p>
      ) : null}
    </section>
  )
}

function ZeroState() {
  const gated = (key: ModeKey, gate: string): Mode => ({ ...MODES[key], stat: '', gate }) as Mode
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl leading-8 font-bold tracking-[-0.025em] text-ink">
          {WORD_COUNT} words.
          <br />
          Start with one.
        </h1>
        <p className="mt-1.5 text-sm leading-5 text-muted">
          Your first session takes about two minutes.
        </p>
      </div>

      <div className={`${CARD} flex flex-col items-center rounded-2xl px-4 pt-6 pb-4 shadow-e2`}>
        <GoalRing fresh done={0} goal={0} streak={0} flame="none" />
        <Link
          to="/learn"
          className={buttonClass('primary', 'mt-4 w-full !h-13 !rounded-lg text-base')}
        >
          Learn your first 5 words
        </Link>
        <p className="mt-2.5 text-xs leading-4 text-muted">Earn 50 XP and your first badge</p>
      </div>

      <div className={`${CARD} flex items-center gap-2.5 rounded-[18px] p-3.5`}>
        <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[11px] bg-xp-soft text-[10px] font-extrabold text-xp">
          XP
        </span>
        <div className="flex-1">
          <p className="text-[13px] leading-[17px] font-semibold text-ink">
            Level 1 begins at your first review
          </p>
          <div className="mt-1.5 h-2 rounded-full bg-line" />
        </div>
      </div>

      <SectionLabel>Four ways to practise</SectionLabel>
      <div className="-mt-2 flex flex-col gap-2">
        <ModeCard mode={{ ...MODES.learn, stat: '' } as Mode} />
        <ModeCard mode={gated('quiz', 'After 10 words')} />
        <ModeCard mode={gated('matching', 'After 10 words')} />
        <ModeCard mode={gated('game', 'After 20 words')} />
      </div>

      <div className={`${CARD} flex items-center gap-3 rounded-[20px] border-dashed p-4`}>
        <span className="grid h-11 w-11 flex-none place-items-center rounded-[15px] bg-gold-soft text-gold">
          <Icon name="spark" size={22} />
        </span>
        <div>
          <p className="text-[13px] leading-[17px] font-semibold text-ink">
            First badge: First Light
          </p>
          <p className="text-xs leading-4 text-muted">Unlocks when you rate your first word</p>
        </div>
      </div>
    </div>
  )
}

export function Home() {
  const userId = useUserId()
  const now = useNow()
  const { reportBadges } = useCelebrate()
  const statsQuery = useQuery({ queryKey: ['stats', userId], queryFn: () => api.stats(userId) })
  const showSkeleton = useMinimumDuration(statsQuery.isLoading)
  const [nudgeDismissed, setNudgeDismissed] = useState(false)

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

  // Keep the high-water mark current, and let the celebration layer decide
  // whether anything here is worth a sheet.
  useEffect(() => {
    if (!reward) return
    rememberXp(reward.xp)
    reportBadges(reward.badges)
  }, [reward, reportBadges])

  if (showSkeleton) return <HomeSkeleton />
  if (statsQuery.isError || !stats || !reward)
    return (
      <ErrorState
        title="Home didn't load"
        message="One request powers this whole screen and it failed. Nothing you have done is lost."
        onRetry={() => void statsQuery.refetch()}
        altLabel="Keep studying"
        onAlt={() => void statsQuery.refetch()}
      />
    )

  if (reward.seen === 0) return <ZeroState />

  const suggested = suggestedMode(stats)
  const rest = (Object.keys(MODES) as ModeKey[]).filter((k) => k !== suggested)
  const suggestedStat = stats.modes.find((m) => m.mode === suggested)
  const remaining = Math.max(0, reward.goal - reward.reviewsToday)
  const toMode = (key: ModeKey): Mode => ({ ...MODES[key], stat: statFor(key, stats) }) as Mode

  // At most once a day, never after 9pm, and only when a live run is at risk.
  const today = now.toISOString().slice(0, 10)
  const showNudge =
    reward.flame === 'atRisk' &&
    !nudgeDismissed &&
    now.getHours() < 21 &&
    localStorage.getItem(NUDGE_KEY) !== today

  return (
    <div className="flex flex-col gap-3">
      <header>
        <p className="text-xs leading-4 text-muted">
          {weekday(now)} - {clockTime(now)}
        </p>
        <h1 className="text-xl leading-[30px] font-bold tracking-[-0.02em] text-ink">
          {reward.goalMet
            ? 'Goal met today'
            : reward.reviewsToday > 0
              ? 'Keep it going'
              : 'Welcome back'}
        </h1>
      </header>

      <section
        className={`${CARD} flex flex-col items-center rounded-2xl px-4 pt-5 pb-4 shadow-e2`}
        aria-label="Today"
      >
        <GoalRing
          done={reward.reviewsToday}
          goal={reward.goal}
          streak={reward.streak}
          flame={reward.flame}
        />
        <div className="mt-3.5 text-center">
          <p className="text-[17px] leading-6 font-semibold text-ink">
            <span className="tabular text-accent">{reward.reviewsToday}</span>
            {reward.goalMet ? ' reviews today' : ` of ${reward.goal} reviews today`}
          </p>
          <p className="text-[13px] leading-[18px] text-muted">
            {reward.goalMet
              ? `Day ${reward.streak} is locked in`
              : `${remaining} more locks in day ${reward.streak + 1}`}
          </p>
        </div>
        <div className="mt-3.5 flex w-full gap-2">
          <Link to="/learn" className={buttonClass('primary', 'flex-1')}>
            Continue session
          </Link>
          <Link
            to="/stats"
            aria-label="Progress"
            className="tap grid h-12 w-12 flex-none place-items-center rounded-[14px] border-[1.5px] border-line text-muted transition-transform duration-[90ms] active:scale-[0.97]"
          >
            <Icon name="stats" size={20} />
          </Link>
        </div>
      </section>

      <LevelStrip reward={reward} />

      <SectionLabel>Practice</SectionLabel>
      <SuggestedModeCard
        mode={{
          ...toMode(suggested),
          detail: suggestedStat
            ? {
                chip: `${pct(suggestedStat)}% accuracy`,
                chipTone: pct(suggestedStat) >= 80 ? 'ok' : 'warn',
                note: `${suggestedStat.attempts.toLocaleString('en-US')} attempts - your weakest mode`,
              }
            : { chip: 'Start here', chipTone: 'accent', note: 'No attempts yet' },
        }}
      />
      <div className="flex flex-col gap-2">
        {rest.map((key) => (
          <ModeCard key={key} mode={toMode(key)} />
        ))}
      </div>

      <BadgeRow badges={reward.badges} nextBadge={reward.nextBadge} />

      {showNudge ? (
        <StreakNudge
          streak={reward.streak}
          goal={reward.goal}
          graceDay={reward.graceDay}
          onDismiss={() => {
            localStorage.setItem(NUDGE_KEY, today)
            setNudgeDismissed(true)
          }}
        />
      ) : null}
    </div>
  )
}
