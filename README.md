# SAT Vocabulary

A full-stack SAT-vocabulary study app: four study modes (Learn, Quiz, Matching,
Word Rush) backed by a Hono/Node API and **PostgreSQL 17 as the single source of
truth** — SM-2 spaced repetition in PL/pgSQL, transactional + idempotent event
writes, SQL-only analytics, and a seeded 120,000-event practice history.

> **Delivery note:** this submission runs locally via Docker instead of a public
> URL (chosen deliberately for this round). `docker compose up --build` brings up
> the entire product; nothing else is required on the host.

## Quickstart (Docker only — no host toolchain needed)

```bash
docker compose up --build -d        # postgres + api (:3001) + web (:8080)
docker compose run --rm seed        # words + 300 users + 120k-event history (~35s)
open http://localhost:8080
```

## Development setup

Requires [Bun](https://bun.sh) 1.3+, Node 22, Docker.

```bash
docker compose up -d postgres       # Postgres 17 on localhost:5434
cp .env.example .env
bun install
bun run db:migrate                  # schema.sql + functions.sql
bun run db:seed                     # full seed incl. 120k fake events
bun run dev                         # api :3001, web :3000 (vite proxies /api)
```

Other commands: `bun run test` (db + api integration suites against real
Postgres), `bun run lint`, `bun run check-types`, `bun run db:parse`
(regenerate the word seed from the PDF), `bun run --filter @vocab/db bench`
(p95 gate), `bun run --filter @vocab/db explain` (refresh EXPLAIN captures).

## Architecture

One Turborepo/Bun monorepo: `apps/web` (Vite + React 19 + Tailwind v4) renders
what the backend sends and posts user actions back; `apps/api` (Hono on Node 22)
validates with zod contracts shared via `packages/shared` and calls into
Postgres; `packages/db` owns every SQL artifact — `schema.sql`,
`functions.sql` (PL/pgSQL), the committed word seed, the PDF parser, the seed
and bench scripts. The backend owns all state: every client mutation is one
`POST /api/events` call into the `record_event` PL/pgSQL function, which
inserts into an **append-only events table**, applies SM-2, and maintains the
analytics rollups in the same transaction. The client stores only its anonymous
user id; `rebuild_from_events()` can reconstruct all derived state from the
event log alone (the seed does exactly that, and a test proves replay ≡ live
ingest).

**Idempotency:** the client generates an `event_id` UUID per action; a unique
index plus `ON CONFLICT DO NOTHING` inside `record_event` makes retries and
double-taps count exactly once (proved over HTTP in the API tests).

## The scheduler (PL/pgSQL, SM-2)

`apply_review(user, word, quality, now)` in `packages/db/functions.sql`:

- `ease' = max(1.3, ease + (0.1 − (5−q) × (0.08 + (5−q) × 0.02)))`
- quality ≥ 3: `repetitions++`, interval 1 day → 6 days → `round(prev × ease')`,
  capped at 365 days (uncapped growth overflows `timestamptz` — found by
  replaying 120k events)
- quality < 3: repetitions and interval reset, the word comes back in 10 minutes
- **mastered** when the interval reaches 21 days (Anki's "mature" convention);
  a later lapse un-masters and decrements the mastery rollup on the *original*
  mastery day so the chart stays consistent

Quality mapping lives in one SQL function: Learn's Again/Hard/Good/Easy →
1/3/4/5; quiz/matching/game answers → correct 4, wrong 1. `review_next(user,
limit)` returns due words first — highest miss rate first, so hard words come
back sooner — then fills the batch with never-seen words.

## Why this game (Word Rush)

A word and a candidate definition appear together; swipe right if they match,
left if they don't (thumb-sized buttons mirror the gesture). 90 seconds, 10
points per hit times a streak multiplier (×1–×4, reset on a miss). Decoy
definitions share the word's part of speech, so the only winning strategy is
actually reading the definition — fast binary *recognition* practice that
complements Quiz's slower 4-option recall. Every judgment is a graded event
that feeds the same SM-2 pipeline. Rejected ideas: falling-word arcade (weak on
small screens, high build cost) and a boss-battle quiz (mechanically just Quiz
with hit points).

## Parsing notes (sat.vocab.pdf)

`bun run db:parse` extracts text with `unpdf` and applies a marker-based
grammar: every part-of-speech marker `(v.|n.|adj.|adv.)` is located with its
optional sense number and preceding headword, which survives line-wrapped
numbering and headwords split from their marker across lines. Normalization
folds curly quotes/dashes, ligatures, NBSP, and page furniture.

- **991 words / 1,047 senses; all 1,047 source markers accounted for; 0 skipped.**
- POS counts: 489 adj, 284 n, 273 v, 1 adv.
- 56 multi-sense entries stored as separate senses (`abide`, `cleave`, and
  `compound` — 3 senses — included).
- **Bad data found** (stored as printed, reported in
  `packages/db/parse-report.json`):
  - Suspected wrong POS labels: `adhere (n.)` ×2 ("to stick to…" — a verb),
    `renunciation (n.)` ("to reject" — verb-shaped), `prescient (adj.)` ("to
    have foreknowledge" — verb-shaped), `archetypal (adj.)` and `palette (adj.)`
    (noun-shaped definitions).
  - Alphabetical-order anomaly: `covert` is printed *after* `covet` (start of
    the "D" page in the source).
  - `façade` (non-ASCII headword) and words split mid-line (`har`/`dy`) parse
    correctly after normalization.

## Performance

Targets: `GET /api/stats` and `GET /api/review/next` p95 < 150 ms with 120k
events / 300 users loaded.

**Measured** (M-series MacBook, `bun run --filter @vocab/db bench`: real HTTP
against the app, 200 requests per endpoint across random seeded users after
warm-up):

| Endpoint | p50 | p95 | p99 |
|---|---|---|---|
| `GET /api/stats` | 1.5 ms | **3.6 ms** | 5.8 ms |
| `GET /api/review/next` | 1.6 ms | **3.1 ms** | 6.0 ms |

**EXPLAIN ANALYZE, before vs after** (full outputs in `packages/db/explain/`,
regenerate with `bun run --filter @vocab/db explain`; measured for the
heaviest seeded user):

| Query | Before | After |
|---|---|---|
| stats: aggregate raw `events` per day | 3.30 ms, 1,469 buffers | — |
| stats: read `user_daily_stats` rollup | — | **0.86 ms, 386 buffers** |
| review_next due scan without `progress(user_id, due_at)` | 2.33 ms, 1,661 buffers | — |
| review_next due scan with the index | — | **1.30 ms, 1,468 buffers** |

What changed and why: stats moved from scanning every event a user ever
produced (grows linearly with history) to small rollup tables maintained
transactionally by `record_event` — the read is O(days shown), not O(events),
so it stays flat as history grows. `review_next` selects the due window through
the `(user_id, due_at)` index instead of filtering the user's whole progress
set through the primary key.

## Design system and the reward layer

The UI is built to the Aurea design (`docs/design/`, exported from Claude
Design). `apps/web/src/index.css` carries that design's own Tailwind v4
`@theme` block: warm paper/ink palette, a full **dark theme** on a `.dark`
class (system by default, with a header toggle, applied before first paint so a
dark reload never flashes light), a type/space/radius/elevation scale, and the
named motions from the design's motion table — every one with a
`prefers-reduced-motion` fallback that still conveys the state.

On top of it sits a **reward layer**: XP, a 12-level curve, 13 badges, a daily
review goal, streak flames at 3/7/30/100, and celebration sheets for a level-up
or a badge unlock. None of it needs a new table or endpoint — `lib/rewards.ts`
is a pure function of the `GET /api/stats` payload.

The one rule that shapes it: **XP can never move backwards.** `mastery_over_time`
is windowed to 30 days, so summing it for a lifetime total would make every
learner's XP shrink on day 31. Lifetime XP therefore reads only the lifetime
rollups (`modes[]`, `totals`) and is floored at a high-water mark; the design's
per-day XP sources still appear, as *session* XP on the screen that earned them.

## Testing

43 database and HTTP tests, all against real Postgres (no mocked I/O): parser
fixtures from real PDF text, schema constraints, hand-computed SM-2
trajectories, HTTP-level idempotency, distractor quality, scheduler ordering,
and a replay-equivalence proof (incremental `record_event` ≡ `COPY` +
`rebuild_from_events`).

Plus 29 frontend unit tests (`bun run --filter @vocab/web test`) over the reward
math — the XP curve, level thresholds and badge predicates — including the two
regressions that matter: a 30-day roll-off must not change XP, and a lapse that
un-masters a word must not lower the level.

Frontend flows were verified in-browser at 390×844: theme switch across all six
routes, reveal/rate with the server-returned interval, quiz sessions with combo
and results, tap+drag matching, a full timed Word Rush run, the offline write
queue (a rating queued while the API was failing, then replayed exactly once),
and seeded plus empty states.

## Repo layout

- `apps/api` — Hono routes (`users`, `words`, `events`, `review`, `quiz`,
  `matching`, `game`, `stats`, `healthz`)
- `apps/web` — mobile-first React app (44px targets, AA contrast in light and
  dark, right/wrong never by color alone, designed loading/error/empty/offline/
  finished states). `components/ui` is the design-system primitive set,
  `lib/rewards.ts` the pure reward engine, `lib/outbox.ts` the offline queue.
- `packages/shared` — zod event schema + response types
- `packages/db` — `schema.sql`, `functions.sql`, `seed_words.sql`,
  `parse-report.json`, parser/seed/bench/explain scripts, all database tests
- `docs/brief` — the take-home brief and the source `sat.vocab.pdf`
- `docs/plans` — the working plans this was built against (process evidence)
- `docs/design` — the exported Claude Design canvas the UI is built to
  (gitignored: ~900 KB of generated reference HTML)

## Hours spent

About 4 hours end to end: one evening session for the backend (parser, schema,
PL/pgSQL scheduler, API, seed and performance work) and the four modes with
their verification pass, followed by the design-system and reward-layer pass
the same night.
