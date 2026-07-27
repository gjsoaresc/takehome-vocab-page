import type postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { resetTestDb } from './helpers'

let sql: postgres.Sql
let userId: string
let wordIds: number[] = []

const T0 = new Date('2026-07-01T12:00:00Z')
const days = (n: number) => new Date(T0.getTime() + n * 86_400_000)

async function addWord(headword: string, pos = 'n'): Promise<number> {
  const [w] = await sql`INSERT INTO words (headword) VALUES (${headword}) RETURNING id`
  await sql`
    INSERT INTO senses (word_id, sense_no, pos, definition, example)
    VALUES (${w!.id}, 1, ${pos}, ${'definition of ' + headword}, ${'Example with ' + headword + '.'})`
  return w!.id as number
}

async function record(
  opts: {
    user?: string
    word: number | null
    mode?: string
    type?: string
    correct?: boolean | null
    rating?: number | null
    at: Date
  },
): Promise<void> {
  await sql`
    SELECT record_event(${crypto.randomUUID()}, ${opts.user ?? userId}, ${opts.mode ?? 'learn'},
      ${opts.type ?? 'rated'}, ${opts.word}, NULL, ${opts.correct ?? null},
      ${opts.rating ?? null}, '{}', ${opts.at})`
}

async function reviewNext(limit: number, at: Date): Promise<Record<string, unknown>[]> {
  return (await sql`SELECT * FROM review_next(${userId}, ${limit}, ${at})`) as unknown as Record<
    string,
    unknown
  >[]
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
  const [user] = await sql`INSERT INTO users DEFAULT VALUES RETURNING id`
  userId = user!.id as string
  wordIds = []
  for (const w of ['alpha', 'bravo', 'charlie', 'delta', 'echo']) {
    wordIds.push(await addWord(w))
  }
})

describe('review_next', () => {
  it('gives a fresh user new words in word order, respecting the limit', async () => {
    const batch = await reviewNext(3, T0)
    expect(batch).toHaveLength(3)
    expect(batch.map((r) => r.reason)).toEqual(['new', 'new', 'new'])
    expect(batch.map((r) => r.word_id)).toEqual(wordIds.slice(0, 3))
  })

  it('returns due words before new words and excludes not-yet-due ones', async () => {
    // alpha reviewed at T0 (due T0+1d); charlie reviewed at T0 with q=5 too.
    await record({ word: wordIds[0]!, rating: 5, at: T0 })
    await record({ word: wordIds[2]!, rating: 5, at: T0 })

    // At T0 nothing is due; both reviewed words are excluded from "new".
    const atT0 = await reviewNext(10, T0)
    expect(atT0.every((r) => r.reason === 'new')).toBe(true)
    expect(atT0.map((r) => r.word_id)).not.toContain(wordIds[0])
    expect(atT0.map((r) => r.word_id)).not.toContain(wordIds[2])

    // Two days later both are overdue and lead the batch.
    const atT2 = await reviewNext(10, days(2))
    expect(atT2.slice(0, 2).map((r) => r.reason)).toEqual(['due', 'due'])
    expect(atT2.slice(2).every((r) => r.reason === 'new')).toBe(true)
  })

  it('boosts miss-heavy words within the due bucket', async () => {
    // bravo: one clean success at T0 -> due T0+1d, miss rate 0.
    await record({ word: wordIds[1]!, rating: 5, at: T0 })
    // delta: missed twice then passed at T0+1h -> due ~T0, miss rate 2/3.
    await record({ word: wordIds[3]!, rating: 1, at: T0 })
    await record({ word: wordIds[3]!, rating: 1, at: new Date(T0.getTime() + 3_600_000) })
    await record({ word: wordIds[3]!, rating: 4, at: new Date(T0.getTime() + 7_200_000) })

    // At T0+2d both are due; bravo has the EARLIER due_at but delta's miss
    // rate must rank it first.
    const batch = await reviewNext(2, days(2))
    expect(batch[0]!.word_id).toBe(wordIds[3])
    expect(batch[1]!.word_id).toBe(wordIds[1])
  })

  it('returns aggregated senses as jsonb', async () => {
    const batch = await reviewNext(1, T0)
    const senses = batch[0]!.senses as { pos: string; definition: string }[]
    expect(Array.isArray(senses)).toBe(true)
    expect(senses[0]).toMatchObject({ pos: 'n', definition: 'definition of alpha' })
  })
})

describe('rebuild_from_events', () => {
  it('replaying the event log reproduces the incrementally-built state', async () => {
    // Deterministic pseudo-random event stream (LCG), two users.
    const [user2] = await sql`INSERT INTO users DEFAULT VALUES RETURNING id`
    const users = [userId, user2!.id as string]
    let seed = 42
    const rand = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648
      return seed / 2_147_483_648
    }
    const modes = ['learn', 'quiz', 'matching', 'game'] as const
    for (let i = 0; i < 200; i++) {
      const at = new Date(T0.getTime() + i * 3_600_000)
      const user = users[Math.floor(rand() * users.length)]!
      const word = wordIds[Math.floor(rand() * wordIds.length)]!
      const mode = modes[Math.floor(rand() * modes.length)]!
      if (rand() < 0.15) {
        await record({ user, word, mode: 'learn', type: 'revealed', at })
      } else if (mode === 'learn') {
        await record({ user, word, mode, type: 'rated', rating: [1, 3, 4, 5][Math.floor(rand() * 4)]!, at })
      } else {
        await record({ user, word, mode, type: 'graded', correct: rand() < 0.7, at })
      }
    }

    const snapshot = async () => ({
      progress: await sql`
        SELECT user_id, word_id, ease, interval_days, repetitions, due_at,
               mastered_at, correct_count, miss_count, last_reviewed_at
        FROM progress ORDER BY user_id, word_id`,
      daily: await sql`
        SELECT user_id, day, reviews, correct, mastered
        FROM user_daily_stats ORDER BY user_id, day`,
      mode: await sql`
        SELECT user_id, mode, attempts, correct
        FROM user_mode_stats ORDER BY user_id, mode`,
    })

    const before = await snapshot()
    expect(before.progress.length).toBeGreaterThan(0)

    const [rebuilt] = await sql`SELECT rebuild_from_events()`
    expect(rebuilt!.rebuild_from_events).toBe(200)

    const after = await snapshot()
    expect(JSON.parse(JSON.stringify(after))).toEqual(JSON.parse(JSON.stringify(before)))
  })
})
