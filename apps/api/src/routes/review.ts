import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db'
import { validate } from '../validation'

export const review = new Hono()

const query = z.object({
  user_id: z.uuid(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

// The scheduler endpoint: the database decides what to study next.
review.get('/next', validate('query', query), async (c) => {
  const { user_id, limit } = c.req.valid('query')
  const items = await db()`SELECT * FROM review_next(${user_id}, ${limit})`
  return c.json({ items })
})
