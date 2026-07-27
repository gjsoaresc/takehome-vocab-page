import { Hono } from 'hono'
import { db } from '../db'
import { userIdQuery, validate } from '../validation'

export const stats = new Hono()

// All aggregation happens in SQL against the rollup tables record_event
// maintains -- no raw-event scans, no client-side totaling.
stats.get('/', validate('query', userIdQuery), async (c) => {
  const { user_id } = c.req.valid('query')
  const sql = db()

  const [masteryOverTime, streakRow, hardest, modes, totalsRow] = await Promise.all([
    sql`
      SELECT day::text AS day, mastered, reviews, correct
      FROM user_daily_stats
      WHERE user_id = ${user_id}
        AND day > (now() AT TIME ZONE 'utc')::date - 30
      ORDER BY day`,
    sql`
      WITH days AS (
        SELECT day, (row_number() OVER (ORDER BY day DESC) - 1)::int AS rn
        FROM user_daily_stats
        WHERE user_id = ${user_id} AND reviews > 0
          AND day <= (now() AT TIME ZONE 'utc')::date
      ),
      anchored AS (
        SELECT CASE
          WHEN EXISTS (SELECT 1 FROM days WHERE day = (now() AT TIME ZONE 'utc')::date)
            THEN (now() AT TIME ZONE 'utc')::date
          ELSE (now() AT TIME ZONE 'utc')::date - 1
        END AS anchor
      )
      SELECT count(*)::int AS streak
      FROM days, anchored
      WHERE day = anchor - rn`,
    sql`
      SELECT p.word_id,
             w.headword,
             (p.correct_count + p.miss_count) AS attempts,
             p.miss_count AS misses,
             round(p.miss_count::numeric / (p.correct_count + p.miss_count), 2)::float8 AS miss_rate
      FROM progress p
      JOIN words w ON w.id = p.word_id
      WHERE p.user_id = ${user_id}
        AND p.correct_count + p.miss_count >= 3
        AND p.miss_count > 0
      ORDER BY p.miss_count::float / (p.correct_count + p.miss_count) DESC, p.miss_count DESC
      LIMIT 10`,
    sql`
      SELECT mode, attempts, correct,
             round(correct::numeric / GREATEST(attempts, 1), 2)::float8 AS accuracy
      FROM user_mode_stats
      WHERE user_id = ${user_id}
      ORDER BY mode`,
    sql`
      SELECT count(*)::int AS words_seen, count(mastered_at)::int AS words_mastered
      FROM progress
      WHERE user_id = ${user_id}`,
  ])

  return c.json({
    mastery_over_time: masteryOverTime,
    streak: streakRow[0]!.streak as number,
    hardest,
    modes,
    totals: totalsRow[0],
  })
})
