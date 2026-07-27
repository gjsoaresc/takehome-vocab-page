import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { db } from './db'
import { events } from './routes/events'
import { game } from './routes/game'
import { matching } from './routes/matching'
import { quiz } from './routes/quiz'
import { review } from './routes/review'
import { stats } from './routes/stats'
import { users } from './routes/users'
import { words } from './routes/words'

export const app = new Hono()

app.use('/api/*', cors())

app.onError((err, c) => {
  // Postgres FK violation on user_id/word_id -> the referenced row is unknown.
  if ((err as { code?: string }).code === '23503') {
    return c.json({ error: { code: 'not_found', message: 'unknown user or word' } }, 404)
  }
  console.error(err)
  return c.json({ error: { code: 'internal', message: 'internal error' } }, 500)
})

app.get('/healthz', async (c) => {
  await db()`SELECT 1`
  return c.json({ ok: true })
})

app.route('/api/users', users)
app.route('/api/words', words)
app.route('/api/events', events)
app.route('/api/review', review)
app.route('/api/quiz', quiz)
app.route('/api/matching', matching)
app.route('/api/game', game)
app.route('/api/stats', stats)
