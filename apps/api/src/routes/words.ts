import { Hono } from 'hono'
import { db } from '../db'
import { userIdQuery, validate } from '../validation'

export const words = new Hono()

// The full word list with per-user progress; the client caches it and
// searches/filters locally. Alphabetical so "covert" lands where readers look.
words.get('/', validate('query', userIdQuery), async (c) => {
  const { user_id } = c.req.valid('query')
  const rows = await db()`
    SELECT w.id,
           w.headword,
           (SELECT jsonb_agg(jsonb_build_object(
                'senseNo', s.sense_no, 'pos', s.pos,
                'definition', s.definition, 'example', s.example
              ) ORDER BY s.sense_no)
            FROM senses s WHERE s.word_id = w.id) AS senses,
           CASE
             WHEN p.mastered_at IS NOT NULL THEN 'mastered'
             WHEN p.user_id IS NOT NULL THEN 'learning'
             ELSE 'new'
           END AS status,
           p.due_at
    FROM words w
    LEFT JOIN progress p ON p.word_id = w.id AND p.user_id = ${user_id}
    ORDER BY lower(w.headword)`
  return c.json({ words: rows })
})
