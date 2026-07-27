// Captures EXPLAIN ANALYZE evidence for the README's performance section:
// the naive query each endpoint WOULD run against raw events (before) vs the
// rollup/index-backed query it actually runs (after). Run: bun run --filter @vocab/db explain
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(pkgRoot, 'explain')
mkdirSync(outDir, { recursive: true })

const url = process.env.DATABASE_URL ?? 'postgres://vocab:vocab@localhost:5434/vocab'
const sql = postgres(url, { max: 1, onnotice: () => {} })

const [user] = await sql`
  SELECT user_id FROM events GROUP BY user_id ORDER BY count(*) DESC LIMIT 1`
const userId = user!.user_id as string

async function explain(query: string, params: unknown[] = []): Promise<string> {
  const rows = await sql.unsafe(`EXPLAIN (ANALYZE, BUFFERS) ${query}`, params as never[])
  return rows.map((r) => r['QUERY PLAN']).join('\n')
}

function save(file: string, title: string, plan: string): void {
  writeFileSync(resolve(outDir, file), `-- ${title}\n-- user: ${userId}\n\n${plan}\n`)
  console.log(`wrote explain/${file}`)
}

// --- GET /api/stats ---------------------------------------------------------
// BEFORE: aggregate the raw append-only event log on every request.
save(
  'stats-before.txt',
  'GET /api/stats computed from raw events (naive approach, not shipped)',
  await explain(
    `SELECT (created_at AT TIME ZONE 'utc')::date AS day,
            count(*) AS reviews,
            count(*) FILTER (WHERE (type = 'rated' AND rating >= 3)
                             OR (type IN ('graded','matched') AND correct)) AS correct
     FROM events
     WHERE user_id = $1 AND type IN ('rated','graded','matched')
     GROUP BY 1 ORDER BY 1`,
    [userId],
  ),
)

// AFTER: read the transactional rollup (what apps/api/src/routes/stats.ts runs).
save(
  'stats-after.txt',
  'GET /api/stats reading the user_daily_stats rollup (shipped)',
  await explain(
    `SELECT day::text AS day, mastered, reviews, correct
     FROM user_daily_stats
     WHERE user_id = $1 AND day > (now() AT TIME ZONE 'utc')::date - 30
     ORDER BY day`,
    [userId],
  ),
)

// --- GET /api/review/next ---------------------------------------------------
// BEFORE: same due-words query with the (user_id, due_at) index disabled.
const before = await sql.begin(async (tx) => {
  await tx.unsafe('DROP INDEX progress_user_due_idx')
  const rows = await tx.unsafe(
    `EXPLAIN (ANALYZE, BUFFERS)
     SELECT p.word_id, p.due_at
     FROM progress p
     WHERE p.user_id = $1 AND p.due_at <= now()
     ORDER BY (p.miss_count::double precision / GREATEST(p.correct_count + p.miss_count, 1)) DESC,
              p.due_at ASC
     LIMIT 10`,
    [userId] as never[],
  )
  await tx.unsafe('ROLLBACK')
  return rows.map((r) => r['QUERY PLAN']).join('\n')
})
save(
  'review-next-before.txt',
  'review_next due-words scan WITHOUT progress(user_id, due_at) index (rolled back)',
  before,
)

save(
  'review-next-after.txt',
  'review_next due-words scan WITH progress(user_id, due_at) index (shipped)',
  await explain(
    `SELECT p.word_id, p.due_at
     FROM progress p
     WHERE p.user_id = $1 AND p.due_at <= now()
     ORDER BY (p.miss_count::double precision / GREATEST(p.correct_count + p.miss_count, 1)) DESC,
              p.due_at ASC
     LIMIT 10`,
    [userId],
  ),
)

await sql.end()
