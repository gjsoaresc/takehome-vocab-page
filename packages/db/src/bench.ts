// p95 gate for the two hot endpoints, run against the seeded database.
// Boots the real Hono app in-process on an ephemeral port so the measurement
// includes routing + validation + SQL over real HTTP. Run: bun run --filter @vocab/db bench
import { serve } from '@hono/node-server'
import { app } from '@vocab/api/app'
import postgres from 'postgres'

const url = process.env.DATABASE_URL ?? 'postgres://vocab:vocab@localhost:5434/vocab'
process.env.DATABASE_URL = url

const TARGET_MS = 150
const WARMUP = 20
const RUNS = 200

const sql = postgres(url, { max: 1 })
const users = await sql`SELECT id FROM users ORDER BY random() LIMIT 50`
await sql.end()
if (users.length === 0) {
  console.error('no seeded users found - run `bun run db:seed` first')
  process.exit(1)
}
const userIds = users.map((u) => u.id as string)

const server = serve({ fetch: app.fetch, port: 0 })
const port = (server.address() as { port: number }).port
const base = `http://127.0.0.1:${port}`
const randomUser = () => userIds[Math.floor(Math.random() * userIds.length)]!

async function bench(name: string, makeUrl: () => string): Promise<number> {
  for (let i = 0; i < WARMUP; i++) await fetch(makeUrl())
  const times: number[] = []
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now()
    const res = await fetch(makeUrl())
    const elapsed = performance.now() - start
    if (!res.ok) {
      console.error(`${name}: HTTP ${res.status}`)
      process.exit(1)
    }
    await res.arrayBuffer()
    times.push(elapsed)
  }
  times.sort((a, b) => a - b)
  const at = (q: number) => times[Math.min(times.length - 1, Math.floor(q * times.length))]!
  const p50 = at(0.5)
  const p95 = at(0.95)
  const p99 = at(0.99)
  console.log(
    `${name.padEnd(18)} p50 ${p50.toFixed(1)}ms  p95 ${p95.toFixed(1)}ms  ` +
      `p99 ${p99.toFixed(1)}ms  max ${times[times.length - 1]!.toFixed(1)}ms  (n=${RUNS})`,
  )
  return p95
}

const statsP95 = await bench('GET /api/stats', () => `${base}/api/stats?user_id=${randomUser()}`)
const reviewP95 = await bench(
  'GET /review/next',
  () => `${base}/api/review/next?user_id=${randomUser()}&limit=10`,
)

server.close()
const ok = statsP95 < TARGET_MS && reviewP95 < TARGET_MS
console.log(ok ? `PASS: both p95 < ${TARGET_MS}ms` : `FAIL: p95 target ${TARGET_MS}ms missed`)
process.exit(ok ? 0 : 1)
