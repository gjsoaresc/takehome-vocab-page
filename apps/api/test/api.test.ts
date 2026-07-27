import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Integration tests: real Postgres (docker compose postgres on :5434), the
// real Hono app via app.request() - no mocked I/O.

const dbDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../packages/db')
const ADMIN_URL = process.env.DATABASE_URL ?? 'postgres://vocab:vocab@localhost:5434/vocab'
const TEST_URL = 'postgres://vocab:vocab@localhost:5434/vocab_test_api'

let sql: postgres.Sql
let app: { request: (input: string, init?: RequestInit) => Response | Promise<Response> }

async function json<T = Record<string, unknown>>(res: Response): Promise<T> {
  expect(res.headers.get('content-type')).toContain('application/json')
  return (await res.json()) as T
}

async function createUser(): Promise<string> {
  const res = await app.request('/api/users', { method: 'POST' })
  expect(res.status).toBe(201)
  return ((await res.json()) as { id: string }).id
}

async function postEvent(body: Record<string, unknown>): Promise<Response> {
  return app.request('/api/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Words seeded with predictable definitions: "<pos>-def-<headword>". */
async function seedWords(): Promise<Record<string, number>> {
  const ids: Record<string, number> = {}
  const entries: Array<[string, string]> = [
    ['apple', 'n'],
    ['banana', 'n'],
    ['cherry', 'n'],
    ['damson', 'n'],
    ['elder', 'n'],
    ['fig', 'n'],
    ['gaudy', 'adj'],
  ]
  for (const [headword, pos] of entries) {
    const [w] = await sql`INSERT INTO words (headword) VALUES (${headword}) RETURNING id`
    ids[headword] = w!.id as number
    await sql`
      INSERT INTO senses (word_id, sense_no, pos, definition, example)
      VALUES (${w!.id}, 1, ${pos}, ${pos + '-def-' + headword}, ${'Example for ' + headword + '.'})`
  }
  return ids
}

let words: Record<string, number>

beforeAll(async () => {
  const dbName = new URL(TEST_URL).pathname.slice(1)
  const admin = postgres(ADMIN_URL, { max: 1 })
  await admin.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`)
  await admin.unsafe(`CREATE DATABASE ${dbName}`)
  await admin.end()

  sql = postgres(TEST_URL, { max: 5, onnotice: () => {} })
  await sql.file(resolve(dbDir, 'schema.sql'))
  const functions = resolve(dbDir, 'functions.sql')
  if (existsSync(functions)) await sql.file(functions)

  process.env.DATABASE_URL = TEST_URL
  ;({ app } = await import('../src/app'))
  words = await seedWords()
})

afterAll(async () => {
  const { closeDb } = await import('../src/db')
  await closeDb()
  await sql?.end()
})

describe('POST /api/users', () => {
  it('creates an anonymous user', async () => {
    const res = await app.request('/api/users', { method: 'POST' })
    expect(res.status).toBe(201)
    const body = await json<{ id: string }>(res)
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('POST /api/events', () => {
  it('is idempotent over HTTP: a double-send counts once', async () => {
    const userId = await createUser()
    const body = {
      event_id: crypto.randomUUID(),
      user_id: userId,
      mode: 'learn',
      type: 'rated',
      word_id: words.apple,
      rating: 4,
    }
    const first = await json<{ duplicate: boolean; progress: { repetitions: number } }>(
      await postEvent(body),
    )
    expect(first.duplicate).toBe(false)
    expect(first.progress.repetitions).toBe(1)

    const second = await json<{ duplicate: boolean }>(await postEvent(body))
    expect(second.duplicate).toBe(true)

    const [mode] = await sql`
      SELECT attempts FROM user_mode_stats WHERE user_id = ${userId} AND mode = 'learn'`
    expect(mode!.attempts).toBe(1)
  })

  it('rejects a payload without event_id', async () => {
    const userId = await createUser()
    const res = await postEvent({ user_id: userId, mode: 'learn', type: 'rated', rating: 4 })
    expect(res.status).toBe(400)
    const body = await json<{ error: { code: string } }>(res)
    expect(body.error.code).toBe('invalid_request')
  })

  it('maps an unknown user to 404', async () => {
    const res = await postEvent({
      event_id: crypto.randomUUID(),
      user_id: crypto.randomUUID(),
      mode: 'learn',
      type: 'rated',
      word_id: words.apple,
      rating: 4,
    })
    expect(res.status).toBe(404)
  })
})

describe('GET /api/words', () => {
  it('returns all words with senses and per-user status', async () => {
    const userId = await createUser()
    await postEvent({
      event_id: crypto.randomUUID(),
      user_id: userId,
      mode: 'learn',
      type: 'rated',
      word_id: words.banana,
      rating: 4,
    })
    const res = await app.request(`/api/words?user_id=${userId}`)
    expect(res.status).toBe(200)
    const body = await json<{
      words: Array<{ id: number; headword: string; status: string; senses: unknown[] }>
    }>(res)
    expect(body.words.length).toBe(7)
    const banana = body.words.find((w) => w.headword === 'banana')!
    expect(banana.status).toBe('learning')
    expect(banana.senses).toHaveLength(1)
    const apple = body.words.find((w) => w.headword === 'apple')!
    expect(apple.status).toBe('new')
  })
})

describe('GET /api/review/next', () => {
  it('returns a batch with reasons and senses', async () => {
    const userId = await createUser()
    const res = await app.request(`/api/review/next?user_id=${userId}&limit=4`)
    expect(res.status).toBe(200)
    const body = await json<{
      items: Array<{ word_id: number; headword: string; reason: string; senses: unknown[] }>
    }>(res)
    expect(body.items).toHaveLength(4)
    expect(body.items.every((i) => i.reason === 'new')).toBe(true)
    expect(body.items[0]!.senses).toHaveLength(1)
  })
})

describe('GET /api/quiz/next', () => {
  it('builds 4-option questions with same-pos distractors and a correct answer index', async () => {
    const userId = await createUser()
    const res = await app.request(`/api/quiz/next?user_id=${userId}&direction=w2d&count=3`)
    const body = await json<{
      questions: Array<{
        word_id: number
        prompt: string
        options: string[]
        answer: number
        pos_relaxed: boolean
      }>
    }>(res)
    expect(body.questions).toHaveLength(3)
    for (const q of body.questions) {
      expect(q.options).toHaveLength(4)
      expect(new Set(q.options).size).toBe(4)
      const headword = Object.entries(words).find(([, id]) => id === q.word_id)![0]
      expect(q.prompt).toBe(headword)
      // Predictable seed definitions let us assert the answer + pos purity.
      const answerText = q.options[q.answer]!
      expect(answerText).toContain(`-def-${headword}`)
      if (!q.pos_relaxed) {
        const pos = answerText.split('-def-')[0]
        for (const opt of q.options) expect(opt.startsWith(`${pos}-def-`)).toBe(true)
      }
    }
  })

  it('excludes words and falls back cross-pos with pos_relaxed for scarce pos', async () => {
    const userId = await createUser()
    // Exclude every noun: only "gaudy" (the lone adj) remains eligible.
    const nounIds = Object.entries(words)
      .filter(([h]) => h !== 'gaudy')
      .map(([, id]) => id)
    const res = await app.request(
      `/api/quiz/next?user_id=${userId}&direction=w2d&count=5&exclude=${nounIds.join(',')}`,
    )
    const body = await json<{
      questions: Array<{ word_id: number; options: string[]; pos_relaxed: boolean }>
    }>(res)
    expect(body.questions).toHaveLength(1)
    const q = body.questions[0]!
    expect(q.word_id).toBe(words.gaudy)
    expect(q.options).toHaveLength(4)
    expect(q.pos_relaxed).toBe(true)
  })

  it('supports definition-to-word direction', async () => {
    const userId = await createUser()
    const res = await app.request(`/api/quiz/next?user_id=${userId}&direction=d2w&count=2`)
    const body = await json<{
      questions: Array<{ word_id: number; prompt: string; options: string[]; answer: number }>
    }>(res)
    for (const q of body.questions) {
      const headword = Object.entries(words).find(([, id]) => id === q.word_id)![0]
      expect(q.prompt).toContain('-def-')
      expect(q.options[q.answer]).toBe(headword)
    }
  })
})

describe('GET /api/matching/next', () => {
  it('returns 6-8 word-unique pairs', async () => {
    const userId = await createUser()
    const res = await app.request(`/api/matching/next?user_id=${userId}`)
    const body = await json<{
      pairs: Array<{ word_id: number; headword: string; definition: string }>
    }>(res)
    expect(body.pairs.length).toBeGreaterThanOrEqual(6)
    expect(body.pairs.length).toBeLessThanOrEqual(8)
    const wordIds = body.pairs.map((p) => p.word_id)
    expect(new Set(wordIds).size).toBe(wordIds.length)
  })
})

describe('GET /api/game/next', () => {
  it('returns a mixed feed of true pairs and plausible decoys', async () => {
    const userId = await createUser()
    const res = await app.request(`/api/game/next?user_id=${userId}&count=20`)
    const body = await json<{
      cards: Array<{ word_id: number; headword: string; definition: string; is_match: boolean }>
    }>(res)
    expect(body.cards).toHaveLength(20)
    const matches = body.cards.filter((c) => c.is_match)
    const decoys = body.cards.filter((c) => !c.is_match)
    expect(matches.length).toBeGreaterThan(0)
    expect(decoys.length).toBeGreaterThan(0)
    for (const c of matches) expect(c.definition).toContain(`-def-${c.headword}`)
    for (const c of decoys) expect(c.definition).not.toContain(`-def-${c.headword}`)
  })
})

describe('GET /api/stats', () => {
  it('aggregates mastery, streak, hardest words, and per-mode accuracy in SQL', async () => {
    const userId = await createUser()
    // Scripted history, all "today": learn 1/1 correct, quiz 1/2 correct.
    await postEvent({
      event_id: crypto.randomUUID(),
      user_id: userId,
      mode: 'learn',
      type: 'rated',
      word_id: words.apple,
      rating: 4,
    })
    await postEvent({
      event_id: crypto.randomUUID(),
      user_id: userId,
      mode: 'quiz',
      type: 'graded',
      word_id: words.banana,
      correct: true,
    })
    await postEvent({
      event_id: crypto.randomUUID(),
      user_id: userId,
      mode: 'quiz',
      type: 'graded',
      word_id: words.banana,
      correct: false,
    })

    const res = await app.request(`/api/stats?user_id=${userId}`)
    const body = await json<{
      mastery_over_time: Array<{ day: string; mastered: number; reviews: number }>
      streak: number
      hardest: unknown[]
      modes: Array<{ mode: string; attempts: number; correct: number }>
      totals: { words_seen: number; words_mastered: number }
    }>(res)

    expect(body.mastery_over_time).toHaveLength(1)
    expect(body.mastery_over_time[0]).toMatchObject({ reviews: 3, mastered: 0 })
    expect(body.streak).toBe(1)
    expect(body.modes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ mode: 'learn', attempts: 1, correct: 1 }),
        expect.objectContaining({ mode: 'quiz', attempts: 2, correct: 1 }),
      ]),
    )
    expect(body.totals).toEqual({ words_seen: 2, words_mastered: 0 })
    expect(body.hardest).toEqual([])
  })
})

describe('GET /healthz', () => {
  it('responds ok with a live database', async () => {
    const res = await app.request('/healthz')
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({ ok: true })
  })
})
