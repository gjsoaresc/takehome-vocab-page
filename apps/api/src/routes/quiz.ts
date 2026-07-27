import type { QuizQuestionDto } from '@vocab/shared'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db'
import { excludeList, validate } from '../validation'

export const quiz = new Hono()

const query = z.object({
  user_id: z.uuid(),
  direction: z.enum(['w2d', 'd2w']).default('w2d'),
  count: z.coerce.number().int().min(1).max(20).default(10),
  exclude: excludeList,
})

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j]!, items[i]!]
  }
  return items
}

// Server-built questions: distractors share the answer's part of speech and
// never come from the answer word itself (multi-sense words must not appear
// as their own distractor). When a pos has fewer than 4 candidate words the
// question falls back to cross-pos options and is flagged pos_relaxed.
quiz.get('/next', validate('query', query), async (c) => {
  const { direction, count, exclude } = c.req.valid('query')
  const sql = db()

  const targets = await sql`
    WITH picked AS (
      SELECT id FROM words
      WHERE id <> ALL(${exclude})
      ORDER BY random()
      LIMIT ${count}
    )
    SELECT DISTINCT ON (s.word_id)
           s.id AS sense_id, s.word_id, s.pos, s.definition, w.headword
    FROM senses s
    JOIN picked p ON p.id = s.word_id
    JOIN words w ON w.id = s.word_id
    ORDER BY s.word_id, random()`

  const questions: QuizQuestionDto[] = []
  for (const t of targets) {
    let posRelaxed = false
    let optionRows: Array<{ text: string }>
    if (direction === 'w2d') {
      optionRows = (await sql`
        SELECT s.definition AS text FROM senses s
        WHERE s.pos = ${t.pos} AND s.word_id <> ${t.word_id} AND s.definition <> ${t.definition}
        ORDER BY random() LIMIT 3`) as unknown as Array<{ text: string }>
      if (optionRows.length < 3) {
        posRelaxed = true
        const extra = await sql`
          SELECT s.definition AS text FROM senses s
          WHERE s.word_id <> ${t.word_id}
            AND s.definition <> ALL(${[t.definition, ...optionRows.map((o) => o.text)]})
          ORDER BY random() LIMIT ${3 - optionRows.length}`
        optionRows = [...optionRows, ...extra] as Array<{ text: string }>
      }
    } else {
      optionRows = (await sql`
        SELECT w.headword AS text FROM words w
        WHERE w.id <> ${t.word_id}
          AND EXISTS (SELECT 1 FROM senses s WHERE s.word_id = w.id AND s.pos = ${t.pos})
        ORDER BY random() LIMIT 3`) as unknown as Array<{ text: string }>
      if (optionRows.length < 3) {
        posRelaxed = true
        const extra = await sql`
          SELECT w.headword AS text FROM words w
          WHERE w.id <> ${t.word_id}
            AND w.headword <> ALL(${optionRows.map((o) => o.text)})
          ORDER BY random() LIMIT ${3 - optionRows.length}`
        optionRows = [...optionRows, ...extra] as Array<{ text: string }>
      }
    }
    const answerText = direction === 'w2d' ? (t.definition as string) : (t.headword as string)
    const options = shuffle([answerText, ...optionRows.map((o) => o.text)])
    questions.push({
      word_id: t.word_id as number,
      sense_id: t.sense_id as number,
      direction,
      prompt: direction === 'w2d' ? (t.headword as string) : (t.definition as string),
      options,
      answer: options.indexOf(answerText),
      pos_relaxed: posRelaxed,
    })
  }
  return c.json({ questions })
})
