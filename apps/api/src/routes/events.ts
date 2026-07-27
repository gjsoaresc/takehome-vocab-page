import { eventInputSchema } from '@vocab/shared'
import { Hono } from 'hono'
import { db } from '../db'
import { validate } from '../validation'

export const events = new Hono()

// THE write path: every client mutation is one idempotent, transactional
// record_event call (see packages/db/functions.sql).
events.post('/', validate('json', eventInputSchema), async (c) => {
  const e = c.req.valid('json')
  const [row] = await db()`
    SELECT record_event(
      ${e.event_id}, ${e.user_id}, ${e.mode}, ${e.type},
      ${e.word_id ?? null}, ${e.sense_id ?? null}, ${e.correct ?? null},
      ${e.rating ?? null}, ${JSON.stringify(e.payload ?? {})}
    ) AS result`
  return c.json(row!.result)
})
