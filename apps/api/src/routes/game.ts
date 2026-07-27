import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db'
import { validate } from '../validation'

export const game = new Hono()

const query = z.object({
  user_id: z.uuid(),
  count: z.coerce.number().int().min(1).max(60).default(30),
})

interface PoolEntry {
  sense_id: number
  word_id: number
  headword: string
  definition: string
  pos: string
}

// Word Rush feed: ~50/50 true pairs vs decoys. Decoys reuse a definition from
// another word with the SAME part of speech, so they read as plausible and
// the game is unwinnable without actually reading definitions.
game.get('/next', validate('query', query), async (c) => {
  const { count } = c.req.valid('query')
  const pool = (await db()`
    SELECT DISTINCT ON (s.word_id)
           s.id AS sense_id, s.word_id, w.headword, s.definition, s.pos
    FROM senses s
    JOIN words w ON w.id = s.word_id
    ORDER BY s.word_id, random()`) as unknown as PoolEntry[]

  const cards = []
  for (let i = 0; i < count && pool.length > 0; i++) {
    const entry = pool[Math.floor(Math.random() * pool.length)]!
    const decoyPool = pool.filter((p) => p.word_id !== entry.word_id && p.pos === entry.pos)
    const useDecoy = decoyPool.length > 0 && Math.random() < 0.5
    const source = useDecoy
      ? decoyPool[Math.floor(Math.random() * decoyPool.length)]!
      : entry
    cards.push({
      word_id: entry.word_id,
      sense_id: source.sense_id,
      headword: entry.headword,
      definition: source.definition,
      is_match: !useDecoy,
    })
  }
  return c.json({ cards })
})
