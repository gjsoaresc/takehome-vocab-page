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
import { clockTime, timeOfDay, useNow, weekday, type TimeOfDay } from '../lib/clock'
import { getBestRun, getStoredGoal, getXpFloor, rememberXp } from '../lib/reward-store'
import {
  WORD_COUNT,
  deriveRewards,
  formatProgress,
  weekStrip,
  type Badge,
  type RewardState,
  type WeekDay,
} from '../lib/rewards'
import { useUserId } from '../lib/user-context'

const NUDGE_KEY = 'vocab.reward.nudge_day'

const GREETING: Record<TimeOfDay, string> = {
  morning: 'Fresh start',
  afternoon: 'Quick one?',
  night: 'Close the day',
}

/**
 * The line under the greeting. It carries the goal state the heading used to,
 * phrased for the hour - a morning that has not started yet reads differently
 * from an evening with four reviews left.
 */
function todLine(tod: TimeOfDay, reward: RewardState, remaining: number): string {
  const nextDay = reward.streak + 1
  if (reward.goalMet) {
    return tod === 'night'
      ? `Day ${reward.streak} is locked. Anything now is a head start on tomorrow.`
      : `Day ${reward.streak} is already locked in.`
  }
  if (tod === 'morning') {
    return `${remaining} reviews puts day ${nextDay} away before the day gets going.`
  }
  if (tod === 'afternoon') {
    return `You are ${remaining} from goal - Word Rush covers it in 90 seconds.`
  }
  return `${remaining} left to lock in day ${nextDay}.`
}

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

/** There are at most three graded modes, so the table only has to reach 3. */
const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n] ?? 'th'}`

/**
 * What holding a mode card reveals. Strictly fields GET /api/stats returns -
 * there is no per-mode time series, so there is no sparkline and no trend.
 */
function peekFor(key: ModeKey, stats: StatsDto): Mode['peek'] {
  if (key === 'learn') {
    const { words_seen, words_mastered } = stats.totals
    return {
      headline: `${words_mastered.toLocaleString('en-US')} mastered`,
      lines: [
        `${words_seen.toLocaleString('en-US')} of ${WORD_COUNT.toLocaleString('en-US')} words seen`,
        `${(WORD_COUNT - words_seen).toLocaleString('en-US')} still untouched`,
      ],
    }
  }

  const here = stats.modes.find((m) => m.mode === key)
  if (!here || here.attempts === 0) return undefined

  const graded = stats.modes.filter((m) => m.mode !== 'learn' && m.attempts > 0)
  const place = [...graded].sort((a, b) => pct(b) - pct(a)).findIndex((m) => m.mode === key) + 1

  return {
    headline: `${pct(here)}% accuracy`,
    lines: [
      `${here.correct.toLocaleString('en-US')} right of ${here.attempts.toLocaleString('en-US')} answered`,
      graded.length > 1
        ? `${ordinal(place)} of your ${graded.length} graded modes`
        : 'Your only graded mode so far',
    ],
  }
}

/** The actual rule behind the suggestion, in the actual numbers. */
function whySuggested(key: ModeKey, stats: StatsDto): string {
  const here = stats.modes.find((m) => m.mode === key)
  if (key === 'learn' || !here || here.attempts === 0) {
    return 'No graded mode has 20 answers yet, so there is nothing to compare. Learn is where every word enters your deck, and it feeds the other three.'
  }
  const rivals = stats.modes
    .filter((m) => m.mode !== 'learn' && m.mode !== key && m.attempts >= 20)
    .sort((a, b) => pct(a) - pct(b))
  const next = rivals[0]
    ? ` The next weakest is ${MODES[rivals[0].mode as ModeKey].name} at ${pct(rivals[0])}%.`
    : ''
  return `${MODES[key].name} is your weakest graded mode at ${pct(here)}% over ${here.attempts.toLocaleString('en-US')} answers.${next} Learn sits out of the comparison because its "accuracy" is the share of self-ratings at Good or better, which is not the same measurement.`
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

const WEEKDAY = (isoDay: string) =>
  new Date(`${isoDay}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    timeZone: 'UTC',
  })

/** What each dot state means, spoken. Never carried by colour alone. */
const DAY_STATE_LABEL: Record<WeekDay['state'], string> = {
  met: 'goal met',
  partial: 'some reviews, goal missed',
  open: 'nothing yet',
}

/**
 * The last seven days, unfolded from under the ring. Six filled dots and one
 * still open tomorrow pulls harder than any counter does.
 *
 * State is legible without colour: a met day carries the flame glyph, a partial
 * day a dashed ring, an open day a plain empty one.
 */
function WeekStrip({ open, days }: { open: boolean; days: WeekDay[] }) {
  return (
    <div
      className="overflow-hidden transition-[max-height] duration-[260ms] ease-standard"
      style={{ maxHeight: open ? 84 : 0 }}
      aria-hidden={!open}
    >
      <ul className="flex justify-between px-1.5 pt-3.5">
        {days.map((d, i) => (
          <li key={d.day} className="flex flex-col items-center gap-1.5">
            <span
              className={`grid h-[26px] w-[26px] place-items-center rounded-full border-[1.5px] ${
                d.state === 'met'
                  ? 'border-flame bg-flame-soft text-flame'
                  : d.state === 'partial'
                    ? 'border-flame border-dashed bg-card text-transparent'
                    : 'border-line bg-card text-transparent'
              }`}
              // Only the entrance staggers; the dots are static once dealt.
              style={
                open
                  ? { animation: 'var(--animate-dot-in)', animationDelay: `${i * 40}ms` }
                  : undefined
              }
            >
              {d.state === 'met' ? <Icon name="flame" size={12} filled /> : null}
            </span>
            <span className="text-[9.5px] leading-none font-semibold text-muted">
              {WEEKDAY(d.day)}
            </span>
            <span className="sr-only">{`${d.reviews} reviews, ${DAY_STATE_LABEL[d.state]}`}</span>
          </li>
        ))}
      </ul>
    </div>
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
  const [weekOpen, setWeekOpen] = useState(false)

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
  const tod = timeOfDay(now)
  const toMode = (key: ModeKey): Mode =>
    ({ ...MODES[key], stat: statFor(key, stats), peek: peekFor(key, stats) }) as Mode

  // At most once a day, never after 9pm, and only when a live run is at risk.
  const today = now.toISOString().slice(0, 10)
  const showNudge =
    reward.flame === 'atRisk' &&
    !nudgeDismissed &&
    now.getHours() < 21 &&
    localStorage.getItem(NUDGE_KEY) !== today

  return (
    <div className="flex flex-col gap-3">
      <header
        className="rounded-2xl px-4 py-3.5 transition-[background-image,color] duration-500"
        style={{ backgroundImage: `var(--tod-${tod}-bg)`, color: `var(--tod-${tod}-fg)` }}
      >
        <p className="text-xs leading-4" style={{ color: `var(--tod-${tod}-sub)` }}>
          {weekday(now)} - {clockTime(now)}
        </p>
        {/* One greeting, not two: the hour picks the words, and the goal state
            it used to carry moves down to the line beneath. */}
        <h1 className="text-xl leading-[30px] font-bold tracking-[-0.02em]">{GREETING[tod]}</h1>
        <p className="mt-1 text-[12.5px] leading-[17px]" style={{ color: `var(--tod-${tod}-sub)` }}>
          {todLine(tod, reward, remaining)}
        </p>
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
        <div className="mt-3.5 w-full text-center">
          {/* The count line is the week toggle - not the ring, which already
              holds the flame's poke target, and not the whole block, because a
              <button> takes phrasing content and would otherwise read out the
              streak sentence as part of its own name. */}
          <button
            type="button"
            onClick={() => setWeekOpen((open) => !open)}
            aria-expanded={weekOpen}
            className="text-[17px] leading-6 font-semibold text-ink"
          >
            <span className="tabular text-accent">{reward.reviewsToday}</span>
            {reward.goalMet ? ' reviews today' : ` of ${reward.goal} reviews today`}
          </button>
          <p className="text-[13px] leading-[18px] text-muted">
            {reward.goalMet
              ? `Day ${reward.streak} is locked in`
              : `${remaining} more locks in day ${reward.streak + 1}`}
          </p>
          <WeekStrip open={weekOpen} days={weekStrip(stats, reward.goal)} />
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
          // The suggested card explains itself instead of peeking: its accuracy
          // chip and note are already on the face, so a peek would unfold what
          // is visible - and two overlays on one card would collide.
          peek: undefined,
          why: whySuggested(suggested, stats),
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
