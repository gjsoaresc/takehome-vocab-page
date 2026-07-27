import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resetTestDb, seedFixture } from './helpers'

let sql: postgres.Sql
let wordId: number
let userId: string

beforeAll(async () => {
  sql = await resetTestDb()
  ;({ wordId, userId } = await seedFixture(sql))
})

afterAll(async () => {
  await sql?.end()
})

describe('schema constraints', () => {
  it('rejects a duplicate event_id (idempotency backstop)', async () => {
    const eventId = crypto.randomUUID()
    await sql`
      INSERT INTO events (event_id, user_id, mode, type, word_id, rating)
      VALUES (${eventId}, ${userId}, 'learn', 'rated', ${wordId}, 4)`
    await expect(
      sql`
        INSERT INTO events (event_id, user_id, mode, type, word_id, rating)
        VALUES (${eventId}, ${userId}, 'learn', 'rated', ${wordId}, 4)`,
    ).rejects.toThrow(/duplicate key|unique/i)
  })

  it('rejects out-of-range ratings', async () => {
    await expect(
      sql`
        INSERT INTO events (event_id, user_id, mode, type, word_id, rating)
        VALUES (${crypto.randomUUID()}, ${userId}, 'learn', 'rated', ${wordId}, 7)`,
    ).rejects.toThrow(/check constraint/i)
  })

  it('rejects unknown modes and event types', async () => {
    await expect(
      sql`
        INSERT INTO events (event_id, user_id, mode, type)
        VALUES (${crypto.randomUUID()}, ${userId}, 'cramming', 'rated')`,
    ).rejects.toThrow(/check constraint/i)
  })

  it('cascades sense deletion when a word is removed', async () => {
    const [w] = await sql`INSERT INTO words (headword) VALUES ('zephyr') RETURNING id`
    await sql`
      INSERT INTO senses (word_id, sense_no, pos, definition)
      VALUES (${w!.id}, 1, 'n', 'a gentle breeze')`
    await sql`DELETE FROM words WHERE id = ${w!.id}`
    const senses = await sql`SELECT 1 FROM senses WHERE word_id = ${w!.id}`
    expect(senses).toHaveLength(0)
  })

  it('applies SM-2 defaults to progress rows', async () => {
    await sql`INSERT INTO progress (user_id, word_id) VALUES (${userId}, ${wordId})`
    const [row] = await sql`
      SELECT ease, interval_days, repetitions FROM progress
      WHERE user_id = ${userId} AND word_id = ${wordId}`
    expect(Number(row!.ease)).toBe(2.5)
    expect(row!.interval_days).toBe(0)
    expect(row!.repetitions).toBe(0)
  })

  it('enforces one progress row per user/word', async () => {
    await expect(
      sql`INSERT INTO progress (user_id, word_id) VALUES (${userId}, ${wordId})`,
    ).rejects.toThrow(/duplicate key/i)
  })
})
