// Full seed: reset schema, load ~1k words, create 300 users, generate 120k
// realistic practice events (deterministic PRNG), bulk-COPY them, then replay
// through rebuild_from_events() so derived state comes from the same SM-2
// logic as the live write path. Run: bun run db:seed
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const url = process.env.DATABASE_URL ?? 'postgres://vocab:vocab@localhost:5434/vocab'

const USERS = 300
const EVENTS = 120_000
const SPAN_DAYS = 60

// Deterministic PRNG (mulberry32) so graders get identical data on every run.
// (A naive LCG overflows Number.MAX_SAFE_INTEGER and skews the distribution.)
let state = 20260727
function rand(): number {
  state = (state + 0x6d2b79f5) | 0
  let t = Math.imul(state ^ (state >>> 15), 1 | state)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
}
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]!

const pad = (n: number, w: number) => String(n).padStart(w, '0')
const userUuid = (i: number) => `00000000-0000-4000-9000-${pad(i, 12)}`
const eventUuid = (i: number) => `00000000-0000-4000-8000-${pad(i, 12)}`

const started = Date.now()
const sql = postgres(url, { max: 1, onnotice: () => {} })

console.log('resetting schema...')
await sql.unsafe('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
await sql.file(resolve(pkgRoot, 'schema.sql'))
await sql.file(resolve(pkgRoot, 'functions.sql'))
await sql.file(resolve(pkgRoot, 'seed_words.sql'))

const words = await sql`SELECT id FROM words ORDER BY id`
const wordIds = words.map((w) => w.id as number)

// Zipf-ish word popularity: earlier ranks get studied far more often.
const shuffledWords = [...wordIds]
for (let i = shuffledWords.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1))
  ;[shuffledWords[i], shuffledWords[j]] = [shuffledWords[j]!, shuffledWords[i]!]
}
const weights = shuffledWords.map((_, rank) => 1 / (rank + 10))
const totalWeight = weights.reduce((a, b) => a + b, 0)
const cumulative: number[] = []
let acc = 0
for (const w of weights) cumulative.push((acc += w / totalWeight))
function pickWord(): number {
  // 70% zipf-weighted (hot words), 30% uniform (breadth across the list).
  if (rand() < 0.3) return shuffledWords[Math.floor(rand() * shuffledWords.length)]!
  const r = rand()
  let lo = 0
  let hi = cumulative.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (cumulative[mid]! < r) lo = mid + 1
    else hi = mid
  }
  return shuffledWords[lo]!
}

console.log(`creating ${USERS} users...`)
{
  const writable = await sql`COPY users (id, created_at) FROM STDIN`.writable()
  const t0 = new Date(Date.now() - SPAN_DAYS * 86_400_000).toISOString()
  for (let i = 0; i < USERS; i++) writable.write(`${userUuid(i)}\t${t0}\n`)
  await new Promise((res, rej) => writable.end(() => res(null)).on('error', rej))
}

// Per-user profile: activity weight (a few heavy users) + accuracy 0.6-0.9.
const profiles = Array.from({ length: USERS }, (_, i) => ({
  id: userUuid(i),
  weight: 1 / (1 + (i % 37)),
  accuracy: 0.6 + rand() * 0.3,
}))
const userTotal = profiles.reduce((a, p) => a + p.weight, 0)
const userCumulative: number[] = []
let uacc = 0
for (const p of profiles) userCumulative.push((uacc += p.weight / userTotal))
function pickUser(): (typeof profiles)[number] {
  const r = rand()
  let lo = 0
  let hi = userCumulative.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (userCumulative[mid]! < r) lo = mid + 1
    else hi = mid
  }
  return profiles[lo]!
}

console.log(`generating + copying ${EVENTS} events...`)
{
  const writable = await sql`
    COPY events (event_id, user_id, mode, type, word_id, sense_id, correct, rating, payload, created_at)
    FROM STDIN`.writable()
  const start = Date.now() - SPAN_DAYS * 86_400_000
  const step = (SPAN_DAYS * 86_400_000) / EVENTS
  const NULL = '\\N'
  for (let i = 0; i < EVENTS; i++) {
    const at = new Date(start + i * step + rand() * step).toISOString()
    const user = pickUser()
    const word = pickWord()
    const correct = rand() < user.accuracy
    const roll = rand()
    let mode: string
    let type: string
    let correctCol = NULL
    let ratingCol = NULL
    let payload = '{}'
    if (roll < 0.15) {
      mode = 'learn'
      type = 'revealed'
    } else if (roll < 0.55) {
      mode = 'learn'
      type = 'rated'
      ratingCol = String(correct ? pick([3, 4, 4, 5]) : pick([0, 1, 2]))
    } else if (roll < 0.8) {
      mode = 'quiz'
      type = 'graded'
      correctCol = correct ? 't' : 'f'
    } else if (roll < 0.92) {
      mode = 'matching'
      type = 'matched'
      correctCol = correct ? 't' : 'f'
    } else if (roll < 0.995) {
      mode = 'game'
      type = 'graded'
      correctCol = correct ? 't' : 'f'
    } else {
      mode = 'game'
      type = 'game_finished'
      payload = `{"score": ${Math.floor(rand() * 500)}}`
    }
    writable.write(
      `${eventUuid(i)}\t${user.id}\t${mode}\t${type}\t${word}\t${NULL}\t${correctCol}\t${ratingCol}\t${payload}\t${at}\n`,
    )
  }
  await new Promise((res, rej) => writable.end(() => res(null)).on('error', rej))
}

console.log('replaying events through rebuild_from_events()...')
const [rebuilt] = await sql`SELECT rebuild_from_events()`
console.log(`replayed ${rebuilt!.rebuild_from_events} events`)

await sql.unsafe('ANALYZE')

const [counts] = await sql`
  SELECT (SELECT count(*)::int FROM words) AS words,
         (SELECT count(*)::int FROM users) AS users,
         (SELECT count(*)::int FROM events) AS events,
         (SELECT count(*)::int FROM progress) AS progress,
         (SELECT count(*)::int FROM user_daily_stats) AS daily_rows`
console.log(
  `seeded: ${counts!.words} words, ${counts!.users} users, ${counts!.events} events, ` +
    `${counts!.progress} progress rows, ${counts!.daily_rows} daily-stat rows ` +
    `in ${((Date.now() - started) / 1000).toFixed(1)}s`,
)
await sql.end()
