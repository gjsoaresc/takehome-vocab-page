import type { SenseDto } from '@vocab/shared'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db'
import { validate } from '../validation'

export const matching = new Hono()

const query = z.object({
  user_id: z.uuid(),
  count: z.coerce.number().int().min(6).max(8).default(8),
})

// A matching board prefers due/hard words: it reuses the scheduler batch,
// which already returns distinct words (never two senses of one word).
matching.get('/next', validate('query', query), async (c) => {
  const { user_id, count } = c.req.valid('query')
  const items = await db()`SELECT * FROM review_next(${user_id}, ${count})`
  const pairs = items.map((item) => {
    const senses = item.senses as SenseDto[]
    const sense = senses[Math.floor(Math.random() * senses.length)]!
    return {
      word_id: item.word_id as number,
      sense_id: 0,
      headword: item.headword as string,
      definition: sense.definition,
    }
  })
  return c.json({ pairs })
})
