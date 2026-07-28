import type { Mode, StatsDto } from '@vocab/shared'
import { describe, expect, it } from 'vitest'
import {
  LEVELS,
  WORD_COUNT,
  badgesFor,
  dailyGoal,
  deriveRewards,
  flameTier,
  formatProgress,
  levelFor,
  lifetimeXp,
  ringDash,
  sessionXp,
} from './rewards'

/** A StatsDto with everything at zero, so each test states only what it needs. */
function stats(patch: Partial<StatsDto> = {}): StatsDto {
  return {
    mastery_over_time: [],
    streak: 0,
    hardest: [],
    modes: [],
    totals: { words_seen: 0, words_mastered: 0 },
    ...patch,
  }
}

const mode = (m: Mode, attempts: number, correct: number) => ({
  mode: m,
  attempts,
  correct,
  accuracy: attempts === 0 ? 0 : correct / attempts,
})

/** UTC day key N days before today, matching the API's `day` format. */
function dayKey(daysAgo: number): string {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysAgo))
    .toISOString()
    .slice(0, 10)
}

const day = (daysAgo: number, reviews: number, mastered = 0) => ({
  day: dayKey(daysAgo),
  reviews,
  mastered,
  correct: Math.round(reviews * 0.8),
})

describe('lifetime XP', () => {
  // 10 per Learn rating + 5 per correct answer in any mode + 25 per mastered word.
  // Worked by hand from the design's XP table:
  //   1,284 ratings         -> 12,840
  //   1,036 + 194 correct   ->  6,150
  //   78 mastered           ->  1,950
  //                            ------
  //                            20,940  -> level 6 (15,500) but not 7 (27,500)
  const heavy = stats({
    modes: [mode('learn', 1284, 1036), mode('quiz', 240, 194)],
    totals: { words_seen: 412, words_mastered: 78 },
  })

  it('sums only lifetime-stable fields', () => {
    expect(lifetimeXp(heavy)).toBe(20_940)
  })

  it('puts that learner at level 6, Rhetorician', () => {
    const r = deriveRewards(heavy)
    expect(r.level).toBe(6)
    expect(r.levelTitle).toBe('Rhetorician')
    expect(r.xpToNext).toBe(27_500 - 20_940)
  })

  it('is unchanged when 30-day activity rolls out of the window', () => {
    // Same underlying history, observed 40 days apart: totals and modes are
    // identical, but the old active days have aged out of mastery_over_time.
    const fresh = stats({ ...heavy, mastery_over_time: [day(1, 30, 2), day(0, 12, 1)] })
    const later = stats({ ...heavy, mastery_over_time: [] })
    expect(lifetimeXp(later)).toBe(lifetimeXp(fresh))
    expect(deriveRewards(later).level).toBe(deriveRewards(fresh).level)
  })

  it('never drops below the high-water mark when a lapse un-masters words', () => {
    const before = deriveRewards(heavy)
    const lapsed = stats({ ...heavy, totals: { words_seen: 412, words_mastered: 75 } })
    expect(lifetimeXp(lapsed)).toBeLessThan(before.xp)
    expect(deriveRewards(lapsed, { xpFloor: before.xp }).xp).toBe(before.xp)
  })

  it('is deterministic', () => {
    expect(deriveRewards(heavy)).toEqual(deriveRewards(heavy))
  })

  it('starts a brand-new learner at level 1 with no XP', () => {
    const r = deriveRewards(stats())
    expect(r.xp).toBe(0)
    expect(r.level).toBe(1)
    expect(r.levelTitle).toBe('Novice')
  })
})

describe('level curve', () => {
  it('matches the design table exactly', () => {
    expect(LEVELS.map((l) => l.at)).toEqual([
      0, 500, 1500, 3500, 7500, 15500, 27500, 44000, 65000, 92000, 126000, 168000,
    ])
    expect(LEVELS[11]).toMatchObject({ level: 12, title: 'Verbatim' })
  })

  it('promotes exactly at each threshold, not one XP earlier', () => {
    expect(levelFor(499).level).toBe(1)
    expect(levelFor(500).level).toBe(2)
    expect(levelFor(167_999).level).toBe(11)
    expect(levelFor(168_000).level).toBe(12)
  })

  it('caps at level 12 with no next level', () => {
    const top = levelFor(999_999)
    expect(top.level).toBe(12)
    expect(top.ceil).toBeNull()
  })
})

describe('session XP', () => {
  it('prices each event the way the design table does', () => {
    expect(sessionXp({ rated: 1 })).toBe(10)
    expect(sessionXp({ correct: 1 })).toBe(5)
    expect(sessionXp({ mastered: 1 })).toBe(25)
    expect(sessionXp({ goalMet: true })).toBe(30)
    expect(sessionXp({ streakDay: 7 })).toBe(50)
    expect(sessionXp({ streakDay: 8 })).toBe(0)
    expect(sessionXp({ runScore: 860 })).toBe(215)
  })

  it('adds its parts', () => {
    expect(sessionXp({ rated: 12, correct: 9, mastered: 4, goalMet: true })).toBe(
      120 + 45 + 100 + 30,
    )
  })
})

describe('daily goal', () => {
  it('defaults to 10 with no history', () => {
    expect(dailyGoal(stats())).toBe(10)
  })

  it('is the median of the last 14 active days', () => {
    const days = [12, 14, 16, 18, 20].map((r, i) => day(i, r))
    expect(dailyGoal(stats({ mastery_over_time: days }))).toBe(16)
  })

  it('ignores zero-review days when taking the median', () => {
    const days = [day(0, 20), day(1, 0), day(2, 0), day(3, 0), day(4, 16)]
    expect(dailyGoal(stats({ mastery_over_time: days }))).toBe(18)
  })

  it('clamps to 8 at the floor and 20 at the ceiling', () => {
    expect(dailyGoal(stats({ mastery_over_time: [day(0, 1), day(1, 2)] }))).toBe(8)
    expect(dailyGoal(stats({ mastery_over_time: [day(0, 90), day(1, 80)] }))).toBe(20)
  })

  it('never rises above a goal the learner already has, but may fall', () => {
    const busy = stats({ mastery_over_time: [day(0, 40), day(1, 40)] })
    const quiet = stats({ mastery_over_time: [day(0, 4), day(1, 4)] })
    expect(dailyGoal(busy, 12)).toBe(12)
    expect(dailyGoal(quiet, 12)).toBe(8)
  })
})

describe('flame tier', () => {
  it('steps at the design milestones', () => {
    expect(flameTier(0, 1)).toBe('none')
    expect(flameTier(2, 1)).toBe('spark')
    expect(flameTier(3, 1)).toBe('day3')
    expect(flameTier(7, 1)).toBe('day7')
    expect(flameTier(30, 1)).toBe('day30')
    expect(flameTier(100, 1)).toBe('day100')
  })

  it('reads at-risk when a live streak has no reviews today', () => {
    expect(flameTier(7, 0)).toBe('atRisk')
    expect(flameTier(0, 0)).toBe('none')
  })
})

describe('badges', () => {
  const ids = (s: StatsDto, bestRun = 0) =>
    badgesFor(s, { bestRunScore: bestRun })
      .filter((b) => b.earned)
      .map((b) => b.id)

  it('ships the design set: 13 badges across 5 families', () => {
    const all = badgesFor(stats(), { bestRunScore: 0 })
    expect(all).toHaveLength(13)
    expect(new Set(all.map((b) => b.family))).toEqual(
      new Set(['breadth', 'depth', 'consistency', 'precision', 'speed']),
    )
  })

  it('flips breadth badges exactly at their threshold', () => {
    expect(ids(stats({ totals: { words_seen: 0, words_mastered: 0 } }))).not.toContain('first-light')
    expect(ids(stats({ totals: { words_seen: 1, words_mastered: 0 } }))).toContain('first-light')
    expect(ids(stats({ totals: { words_seen: 249, words_mastered: 0 } }))).not.toContain('wide-net')
    expect(ids(stats({ totals: { words_seen: 250, words_mastered: 0 } }))).toContain('wide-net')
    expect(
      ids(stats({ totals: { words_seen: WORD_COUNT, words_mastered: 0 } })),
    ).toContain('full-sweep')
  })

  it('flips depth badges exactly at their threshold', () => {
    expect(ids(stats({ totals: { words_seen: 999, words_mastered: 99 } }))).not.toContain('century')
    expect(ids(stats({ totals: { words_seen: 999, words_mastered: 100 } }))).toContain('century')
    expect(ids(stats({ totals: { words_seen: 999, words_mastered: 500 } }))).toContain('half-book')
    expect(
      ids(stats({ totals: { words_seen: WORD_COUNT, words_mastered: WORD_COUNT } })),
    ).toContain('complete')
  })

  it('flips consistency badges exactly at their threshold', () => {
    expect(ids(stats({ streak: 2 }))).not.toContain('three-days')
    expect(ids(stats({ streak: 3 }))).toContain('three-days')
    expect(ids(stats({ streak: 7 }))).toContain('week-runner')
    expect(ids(stats({ streak: 30 }))).toContain('month-straight')
    expect(ids(stats({ streak: 100 }))).toContain('hundred-days')
  })

  it('requires both the accuracy and the attempt floor for precision badges', () => {
    // 90% accuracy but only 99 attempts - not yet.
    expect(ids(stats({ modes: [mode('game', 99, 90)] }))).not.toContain('sharpshooter')
    expect(ids(stats({ modes: [mode('game', 100, 90)] }))).toContain('sharpshooter')
    // Both Directions is quiz-only: a 90% matching run must not earn it.
    expect(ids(stats({ modes: [mode('matching', 200, 180)] }))).not.toContain('both-directions')
    expect(ids(stats({ modes: [mode('quiz', 150, 128)] }))).toContain('both-directions')
  })

  it('earns the speed badge from a single run score', () => {
    expect(ids(stats(), 499)).not.toContain('rush-hour')
    expect(ids(stats(), 500)).toContain('rush-hour')
  })

  it('gives every locked badge a stated condition and a progress pair', () => {
    for (const b of badgesFor(stats(), { bestRunScore: 0 })) {
      expect(b.condition.length).toBeGreaterThan(0)
      expect(b.progress.target).toBeGreaterThan(0)
      expect(b.progress.current).toBeLessThanOrEqual(b.progress.target)
    }
  })

  it('labels precision progress as a percentage until the accuracy gate is met', () => {
    // 89% over 860 attempts: plenty of attempts, but short of the 90% gate, so
    // the pair must read as accuracy - not as "89 of the 100 attempts needed".
    const short = badgesFor(stats({ modes: [mode('quiz', 860, 765)] }), { bestRunScore: 0 })
    const sharp = short.find((b) => b.id === 'sharpshooter')!
    expect(sharp.earned).toBe(false)
    expect(sharp.progress).toEqual({ current: 89, target: 90, unit: 'percent' })
    expect(formatProgress(sharp.progress)).toBe('89% of 90%')

    // Once accuracy clears, attempts are what is left, and it counts.
    const accurate = badgesFor(stats({ modes: [mode('quiz', 60, 58)] }), { bestRunScore: 0 })
    const sharp2 = accurate.find((b) => b.id === 'sharpshooter')!
    expect(sharp2.progress).toEqual({ current: 60, target: 100, unit: 'count' })
    expect(formatProgress(sharp2.progress)).toBe('60/100')
  })
})

describe('ringDash', () => {
  it('offsets half the circumference at 50%', () => {
    const { dasharray, dashoffset } = ringDash(0.5, 41)
    expect(dasharray).toBeCloseTo(2 * Math.PI * 41, 5)
    expect(dashoffset).toBeCloseTo(dasharray / 2, 5)
  })

  it('is a full arc at 100% and an empty one at 0%', () => {
    expect(ringDash(1, 41).dashoffset).toBe(0)
    expect(ringDash(0, 41).dashoffset).toBeCloseTo(ringDash(0, 41).dasharray, 5)
  })

  it('clamps out-of-range input instead of drawing past the circle', () => {
    expect(ringDash(1.5, 41).dashoffset).toBe(0)
    expect(ringDash(-1, 41).dashoffset).toBeCloseTo(ringDash(0, 41).dasharray, 5)
  })
})
