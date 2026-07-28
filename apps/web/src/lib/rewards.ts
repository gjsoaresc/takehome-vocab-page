import type { Mode, StatsDto } from '@vocab/shared'

/**
 * The reward layer, as a pure function of what the server already returns.
 *
 * Spec: docs/design/SAT Vocab Reward System.dc.html (the trailing
 * <script type="text/x-dc"> block holds the canonical curve and badge table).
 *
 * The one rule that shapes everything here: XP must never move backwards.
 * `mastery_over_time` is windowed to the trailing 30 UTC days by the API
 * (apps/api/src/routes/stats.ts), so summing it for a lifetime total would make
 * XP shrink for every learner on day 31. Lifetime XP therefore reads only
 * `modes[]` and `totals`, which are lifetime rollups. The design's per-day XP
 * sources still appear in the UI - as session XP, on the screen that earned it.
 */

/** Words in the corpus. 991, not the design's round 1,000: the source PDF
 *  parses to 991 words / 1,047 senses (packages/db/parse-report.json). */
export const WORD_COUNT = 991

/** Mastery milestones on the Progress hero track. */
export const MILESTONES = [100, 250, 500, WORD_COUNT] as const

export const XP = {
  perRating: 10,
  perCorrect: 5,
  perMastered: 25,
  goalMet: 30,
  seventhStreakDay: 50,
  runScoreDivisor: 4,
} as const

const LEVEL_AT = [0, 500, 1500, 3500, 7500, 15500, 27500, 44000, 65000, 92000, 126000, 168000]
const LEVEL_TITLES = [
  'Novice',
  'Reader',
  'Collector',
  'Lexicon',
  'Wordsmith',
  'Rhetorician',
  'Orator',
  'Philologist',
  'Etymologist',
  'Polymath',
  'Sesquipedalian',
  'Verbatim',
]

export interface LevelDef {
  level: number
  title: string
  at: number
}

export const LEVELS: LevelDef[] = LEVEL_AT.map((at, i) => ({
  level: i + 1,
  title: LEVEL_TITLES[i]!,
  at,
}))

export interface LevelState {
  level: number
  title: string
  /** XP at which this level started. */
  floor: number
  /** XP the next level needs, or null at the cap. */
  ceil: number | null
}

export function levelFor(xp: number): LevelState {
  let i = 0
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1]!.at) i++
  const here = LEVELS[i]!
  const next = LEVELS[i + 1]
  return { level: here.level, title: here.title, floor: here.at, ceil: next ? next.at : null }
}

const modeStat = (stats: StatsDto, mode: Mode) => stats.modes.find((m) => m.mode === mode)

/**
 * Lifetime XP - the number that drives the level. Sources, all lifetime-stable:
 *  - every word rated in Learn      -> modes[learn].attempts
 *  - every correct answer, any mode -> sum(modes[].correct)
 *  - every word mastered            -> totals.words_mastered
 */
export function lifetimeXp(stats: StatsDto): number {
  const rated = modeStat(stats, 'learn')?.attempts ?? 0
  const correct = stats.modes.reduce((sum, m) => sum + m.correct, 0)
  return (
    rated * XP.perRating +
    correct * XP.perCorrect +
    stats.totals.words_mastered * XP.perMastered
  )
}

export interface SessionXpParts {
  /** Words rated in Learn this session. */
  rated?: number
  /** Correct answers this session, any mode. */
  correct?: number
  /** Words that reached mastered this session. */
  mastered?: number
  /** Whether today's review goal was met. */
  goalMet?: boolean
  /** Today's streak length - pays out on every seventh day. */
  streakDay?: number
  /** Final score of a Word Rush run. */
  runScore?: number
}

/**
 * XP earned in one sitting, shown on session-end screens. Deliberately NOT
 * added to the lifetime total: the last three sources are per-day, and folding
 * them into an accumulator is what would make the level fall over time.
 */
export function sessionXp(parts: SessionXpParts): number {
  const streakBonus =
    parts.streakDay && parts.streakDay > 0 && parts.streakDay % 7 === 0
      ? XP.seventhStreakDay
      : 0
  return (
    (parts.rated ?? 0) * XP.perRating +
    (parts.correct ?? 0) * XP.perCorrect +
    (parts.mastered ?? 0) * XP.perMastered +
    (parts.goalMet ? XP.goalMet : 0) +
    streakBonus +
    Math.floor((parts.runScore ?? 0) / XP.runScoreDivisor)
  )
}

const utcToday = () => new Date().toISOString().slice(0, 10)

/** Days with at least one review, most recent first. */
function activeDays(stats: StatsDto) {
  return stats.mastery_over_time
    .filter((d) => d.reviews > 0)
    .sort((a, b) => (a.day < b.day ? 1 : -1))
}

const GOAL_FLOOR = 8
const GOAL_CEIL = 20
const GOAL_DEFAULT = 10
const GOAL_WINDOW = 14

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/**
 * The daily review target: the median of the last 14 active days, clamped to
 * 8-20. It fits the person rather than the product - and it never rises on its
 * own. A lower target applies immediately (restarting should be easier than
 * continuing was); a higher one waits for the learner to opt in.
 */
export function dailyGoal(stats: StatsDto, storedGoal?: number): number {
  const recent = activeDays(stats).slice(0, GOAL_WINDOW)
  if (recent.length === 0) return storedGoal ?? GOAL_DEFAULT
  const raw = Math.round(median(recent.map((d) => d.reviews)))
  const clamped = Math.min(GOAL_CEIL, Math.max(GOAL_FLOOR, raw))
  return storedGoal == null ? clamped : Math.min(clamped, storedGoal)
}

export type FlameTier = 'none' | 'spark' | 'day3' | 'day7' | 'day30' | 'day100' | 'atRisk'

/** A live streak with nothing done today reads at-risk, whatever its length. */
export function flameTier(streak: number, reviewsToday: number): FlameTier {
  if (streak < 1) return 'none'
  if (reviewsToday === 0) return 'atRisk'
  if (streak >= 100) return 'day100'
  if (streak >= 30) return 'day30'
  if (streak >= 7) return 'day7'
  if (streak >= 3) return 'day3'
  return 'spark'
}

/**
 * Whether a skipped day would be carried by the design's grace rule: one zero
 * day inside an otherwise complete week reads through. This drives the nudge
 * copy only - the streak NUMBER always stays whatever the server says, so the
 * UI can never show two competing streaks.
 */
export function hasGraceDay(stats: StatsDto, goal: number): boolean {
  const byDay = new Map(stats.mastery_over_time.map((d) => [d.day, d.reviews]))
  const today = new Date(`${utcToday()}T00:00:00Z`).getTime()
  let met = 0
  for (let i = 1; i <= 6; i++) {
    const key = new Date(today - i * 86_400_000).toISOString().slice(0, 10)
    if ((byDay.get(key) ?? 0) >= goal) met++
  }
  return met === 6
}

export type BadgeFamily = 'breadth' | 'depth' | 'consistency' | 'precision' | 'speed'

export interface Badge {
  id: string
  name: string
  family: BadgeFamily
  /** The unlock rule in the payload's own field language, shown verbatim. */
  condition: string
  earned: boolean
  /**
   * Bar fuel. `current` is clamped to `target`; `condition` is the truth.
   * `unit` says which half of a two-part rule the pair is counting, so the UI
   * never prints "89/90" next to a condition about attempts.
   */
  progress: { current: number; target: number; unit: ProgressUnit }
}

export type ProgressUnit = 'count' | 'percent'

export interface BadgeContext {
  /** Best single Word Rush score. Device-local - see lib/reward-store.ts. */
  bestRunScore: number
}

const clampProgress = (current: number, target: number, unit: ProgressUnit = 'count') => ({
  current: Math.max(0, Math.min(current, target)),
  target,
  unit,
})

/**
 * Progress for a two-part "accuracy X over N attempts" rule: once the accuracy
 * gate is cleared the attempts count is what is left to earn, otherwise the
 * accuracy is. Whichever is furthest behind is the honest thing to show.
 */
function precisionProgress(
  candidates: StatsDto['modes'],
  minAccuracy: number,
  minAttempts: number,
) {
  const accurate = candidates.filter((m) => m.attempts > 0 && m.correct / m.attempts >= minAccuracy)
  if (accurate.length > 0) {
    const best = Math.max(...accurate.map((m) => m.attempts))
    return clampProgress(best, minAttempts, 'count')
  }
  const bestAccuracy = candidates.length
    ? Math.max(...candidates.map((m) => (m.attempts > 0 ? m.correct / m.attempts : 0)))
    : 0
  return clampProgress(Math.round(bestAccuracy * 100), Math.round(minAccuracy * 100), 'percent')
}

function meetsPrecision(
  candidates: StatsDto['modes'],
  minAccuracy: number,
  minAttempts: number,
): boolean {
  return candidates.some(
    (m) => m.attempts >= minAttempts && m.correct / m.attempts >= minAccuracy,
  )
}

/**
 * The design's 13 badges. Every condition is computable from this payload
 * alone. An earned badge never greys out again even if the stat later dips -
 * that latching lives in lib/reward-store.ts, not here.
 */
export function badgesFor(stats: StatsDto, ctx: BadgeContext): Badge[] {
  const { words_seen: seen, words_mastered: mastered } = stats.totals
  const streak = stats.streak
  const quiz = modeStat(stats, 'quiz')

  const threshold = (
    id: string,
    name: string,
    family: BadgeFamily,
    condition: string,
    value: number,
    target: number,
  ): Badge => ({
    id,
    name,
    family,
    condition,
    earned: value >= target,
    progress: clampProgress(value, target),
  })

  return [
    threshold('first-light', 'First Light', 'breadth', 'words_seen >= 1', seen, 1),
    threshold('wide-net', 'Wide Net', 'breadth', 'words_seen >= 250', seen, 250),
    threshold(
      'full-sweep',
      'Full Sweep',
      'breadth',
      `words_seen = ${WORD_COUNT}`,
      seen,
      WORD_COUNT,
    ),
    threshold('century', 'Century', 'depth', 'words_mastered >= 100', mastered, 100),
    threshold('half-book', 'Half the Book', 'depth', 'words_mastered >= 500', mastered, 500),
    threshold(
      'complete',
      'Complete',
      'depth',
      `words_mastered = ${WORD_COUNT}`,
      mastered,
      WORD_COUNT,
    ),
    threshold('three-days', 'Three Days', 'consistency', 'streak >= 3', streak, 3),
    threshold('week-runner', 'Week Runner', 'consistency', 'streak >= 7', streak, 7),
    threshold('month-straight', 'Month Straight', 'consistency', 'streak >= 30', streak, 30),
    threshold('hundred-days', 'Hundred Days', 'consistency', 'streak >= 100', streak, 100),
    {
      id: 'sharpshooter',
      name: 'Sharpshooter',
      family: 'precision',
      condition: 'any mode: accuracy >= 0.9 with attempts >= 100',
      earned: meetsPrecision(stats.modes, 0.9, 100),
      progress: precisionProgress(stats.modes, 0.9, 100),
    },
    {
      id: 'both-directions',
      name: 'Both Directions',
      family: 'precision',
      condition: 'Quiz: accuracy >= 0.85 with attempts >= 150',
      earned: meetsPrecision(quiz ? [quiz] : [], 0.85, 150),
      progress: precisionProgress(quiz ? [quiz] : [], 0.85, 150),
    },
    {
      id: 'rush-hour',
      name: 'Rush Hour',
      family: 'speed',
      condition: 'run.score >= 500 in a single Word Rush',
      earned: ctx.bestRunScore >= 500,
      progress: clampProgress(ctx.bestRunScore, 500),
    },
  ]
}

/** Circumference and offset for an SVG progress ring at `pct` (0-1). */
export function ringDash(pct: number, radius: number): { dasharray: number; dashoffset: number } {
  const dasharray = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(1, pct))
  return { dasharray, dashoffset: dasharray * (1 - clamped) }
}

export interface DeriveOptions {
  /** Highest XP ever shown to this learner; XP is floored at it so a lapse
   *  that un-masters a word cannot walk the level backwards. */
  xpFloor?: number
  /** Best single Word Rush score on this device. */
  bestRunScore?: number
  /** Daily goal already agreed with the learner; a new one never exceeds it. */
  storedGoal?: number
}

export interface RewardState {
  xp: number
  level: number
  levelTitle: string
  levelFloor: number
  levelCeil: number | null
  xpToNext: number | null
  /** 0-1 through the current level; 1 at the cap. */
  levelProgress: number
  streak: number
  flame: FlameTier
  goal: number
  reviewsToday: number
  goalMet: boolean
  graceDay: boolean
  mastered: number
  seen: number
  /** Next mastery milestone, or null once the corpus is complete. */
  nextMilestone: number | null
  badges: Badge[]
  earnedBadges: Badge[]
  /** The nearest locked badge, by share of its condition completed. */
  nextBadge: Badge | null
}

export function deriveRewards(stats: StatsDto, opts: DeriveOptions = {}): RewardState {
  const xp = Math.max(lifetimeXp(stats), opts.xpFloor ?? 0)
  const { level, title, floor, ceil } = levelFor(xp)
  const today = utcToday()
  const reviewsToday = stats.mastery_over_time.find((d) => d.day === today)?.reviews ?? 0
  const goal = dailyGoal(stats, opts.storedGoal)
  const badges = badgesFor(stats, { bestRunScore: opts.bestRunScore ?? 0 })
  const locked = badges.filter((b) => !b.earned)

  return {
    xp,
    level,
    levelTitle: title,
    levelFloor: floor,
    levelCeil: ceil,
    xpToNext: ceil === null ? null : ceil - xp,
    levelProgress: ceil === null ? 1 : (xp - floor) / (ceil - floor),
    streak: stats.streak,
    flame: flameTier(stats.streak, reviewsToday),
    goal,
    reviewsToday,
    goalMet: reviewsToday >= goal,
    graceDay: hasGraceDay(stats, goal),
    mastered: stats.totals.words_mastered,
    seen: stats.totals.words_seen,
    nextMilestone: MILESTONES.find((m) => stats.totals.words_mastered < m) ?? null,
    badges,
    earnedBadges: badges.filter((b) => b.earned),
    nextBadge:
      locked.sort(
        (a, b) => b.progress.current / b.progress.target - a.progress.current / a.progress.target,
      )[0] ?? null,
  }
}

/** "89% of 90%" for an accuracy gate, "412/500" for a plain count. */
export function formatProgress(p: Badge['progress']): string {
  return p.unit === 'percent'
    ? `${p.current}% of ${p.target}%`
    : `${p.current.toLocaleString('en-US')}/${p.target.toLocaleString('en-US')}`
}
