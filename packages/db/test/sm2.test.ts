import type postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { resetTestDb, seedFixture } from './helpers'

// Expected values are hand-computed from the SM-2 spec (SuperMemo 2):
//   ease' = max(1.3, ease + (0.1 - (5-q) * (0.08 + (5-q) * 0.02)))
//   q>=3: reps++, interval = 1, 6, round(prev_interval * ease')
//   q<3:  reps=0, interval=0, due in 10 minutes
// Mastered when interval_days >= 21; a later q<3 un-masters and the
// mastered rollup decrement targets the ORIGINAL mastery day.

let sql: postgres.Sql
let wordId: number
let userId: string

const T0 = new Date('2026-07-01T12:00:00Z')
const days = (n: number) => new Date(T0.getTime() + n * 86_400_000)

async function rate(quality: number, at: Date, word = wordId): Promise<Record<string, unknown>> {
  const [row] = await sql`
    SELECT record_event(${crypto.randomUUID()}, ${userId}, 'learn', 'rated',
      ${word}, NULL, NULL, ${quality}, '{}', ${at}) AS r`
  return row!.r as Record<string, unknown>
}

async function getProgress(word = wordId): Promise<Record<string, unknown>> {
  const [row] = await sql`
    SELECT * FROM progress WHERE user_id = ${userId} AND word_id = ${word}`
  return row as Record<string, unknown>
}

beforeAll(async () => {
  sql = await resetTestDb()
})

afterAll(async () => {
  await sql?.end()
})

beforeEach(async () => {
  await sql`TRUNCATE events, progress, user_daily_stats, user_mode_stats`
  await sql`DELETE FROM users`
  await sql`DELETE FROM words`
  ;({ wordId, userId } = await seedFixture(sql))
})

describe('record_event idempotency', () => {
  it('is a no-op on a duplicate event_id: one event row, unchanged state', async () => {
    const eventId = crypto.randomUUID()
    const call = () => sql`
      SELECT record_event(${eventId}, ${userId}, 'learn', 'rated',
        ${wordId}, NULL, NULL, 4, '{}', ${T0}) AS r`
    const [first] = await call()
    expect((first!.r as { duplicate: boolean }).duplicate).toBe(false)

    const before = await getProgress()
    const [second] = await call()
    expect((second!.r as { duplicate: boolean }).duplicate).toBe(true)

    const [{ count }] = await sql`SELECT count(*)::int AS count FROM events`
    expect(count).toBe(1)
    expect(await getProgress()).toEqual(before)
    const [daily] = await sql`SELECT reviews, correct FROM user_daily_stats`
    expect(daily).toEqual({ reviews: 1, correct: 1 })
  })
})

describe('SM-2 trajectory', () => {
  it('follows the spec for a perfect run: ease 2.6/2.7/2.8, intervals 1/6/17', async () => {
    await rate(5, T0)
    let p = await getProgress()
    expect(Number(p.ease)).toBe(2.6)
    expect(p.repetitions).toBe(1)
    expect(p.interval_days).toBe(1)
    expect(new Date(p.due_at as string).getTime()).toBe(days(1).getTime())

    await rate(5, days(1))
    p = await getProgress()
    expect(Number(p.ease)).toBe(2.7)
    expect(p.repetitions).toBe(2)
    expect(p.interval_days).toBe(6)

    await rate(5, days(7))
    p = await getProgress()
    expect(Number(p.ease)).toBe(2.8)
    expect(p.repetitions).toBe(3)
    expect(p.interval_days).toBe(17)
    expect(new Date(p.due_at as string).getTime()).toBe(
      new Date(days(7).getTime() + 17 * 86_400_000).getTime(),
    )
  })

  it('a lapse (q<3) resets repetitions and interval and comes due in 10 minutes', async () => {
    await rate(5, T0)
    await rate(5, days(1))
    await rate(5, days(7)) // ease 2.8, interval 17
    await rate(2, days(10)) // delta = 0.1 - 3*(0.08 + 3*0.02) = -0.32
    const p = await getProgress()
    expect(Number(p.ease)).toBe(2.48)
    expect(p.repetitions).toBe(0)
    expect(p.interval_days).toBe(0)
    expect(new Date(p.due_at as string).getTime()).toBe(days(10).getTime() + 10 * 60_000)
    expect(p.miss_count).toBe(1)
    expect(p.correct_count).toBe(3)
  })

  it('floors ease at 1.3', async () => {
    for (let i = 0; i < 5; i++) await rate(0, days(i))
    const p = await getProgress()
    expect(Number(p.ease)).toBe(1.3)
  })
})

describe('mastery', () => {
  it('sets mastered_at when the interval reaches 21 days', async () => {
    await rate(5, T0)
    await rate(5, days(1))
    await rate(5, days(7)) // interval 17, not yet mastered
    let p = await getProgress()
    expect(p.mastered_at).toBeNull()

    await rate(5, days(24)) // ease 2.9, interval round(17*2.9) = 49 -> mastered
    p = await getProgress()
    expect(p.interval_days).toBe(49)
    expect(p.mastered_at).not.toBeNull()
    const [daily] = await sql`
      SELECT mastered FROM user_daily_stats
      WHERE user_id = ${userId} AND day = ${days(24).toISOString().slice(0, 10)}`
    expect(daily!.mastered).toBe(1)
  })

  it('un-mastering decrements the ORIGINAL mastery day, not the miss day', async () => {
    await rate(5, T0)
    await rate(5, days(1))
    await rate(5, days(7))
    await rate(5, days(24)) // mastered on day 24
    await rate(1, days(30)) // lapse un-masters

    const p = await getProgress()
    expect(p.mastered_at).toBeNull()

    const masteredByDay = Object.fromEntries(
      (await sql`SELECT day::text, mastered FROM user_daily_stats`).map((r) => [
        r.day,
        r.mastered,
      ]),
    )
    expect(masteredByDay[days(24).toISOString().slice(0, 10)]).toBe(0)
    expect(masteredByDay[days(30).toISOString().slice(0, 10)]).toBe(0)
  })
})

describe('rollups and non-scoring events', () => {
  it('updates daily and mode rollups only for scoring events', async () => {
    // A reveal records the event but must not touch progress or rollups.
    await sql`
      SELECT record_event(${crypto.randomUUID()}, ${userId}, 'learn', 'revealed',
        ${wordId}, NULL, NULL, NULL, '{}', ${T0})`
    expect((await sql`SELECT 1 FROM progress`).length).toBe(0)
    expect((await sql`SELECT 1 FROM user_daily_stats`).length).toBe(0)

    // A graded quiz answer maps correct -> quality 4, wrong -> 1.
    await sql`
      SELECT record_event(${crypto.randomUUID()}, ${userId}, 'quiz', 'graded',
        ${wordId}, NULL, true, NULL, '{}', ${T0})`
    await sql`
      SELECT record_event(${crypto.randomUUID()}, ${userId}, 'quiz', 'graded',
        ${wordId}, NULL, false, NULL, '{}', ${T0})`
    const [mode] = await sql`
      SELECT attempts, correct FROM user_mode_stats WHERE mode = 'quiz'`
    expect(mode).toEqual({ attempts: 2, correct: 1 })
    const [daily] = await sql`SELECT reviews, correct FROM user_daily_stats`
    expect(daily).toEqual({ reviews: 2, correct: 1 })
    const [{ count }] = await sql`SELECT count(*)::int AS count FROM events`
    expect(count).toBe(3)
  })
})
