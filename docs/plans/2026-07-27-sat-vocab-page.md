# SAT Vocab App (PolyPrep Take-home) Implementation Plan

Created: 2026-07-27
Author: jacob@evren.gg
Agent: Claude Code
Status: PENDING
Approved: Yes
Iterations: 0
Worktree: No
Type: Feature

## Summary

**Goal:** A complete, locally runnable (Docker) SAT-vocabulary study app answering `Vocab Page - Amadeu/PolyPrep_Take-home.docx`: Turborepo monorepo with a Hono/Node API, a Vite/React mobile-first web app with four study modes (Learn, Quiz, Matching, Game) plus a stats dashboard, and Postgres 17 as the single source of truth — SM-2 scheduler in PL/pgSQL, transactional + idempotent event writes, SQL-only analytics, seeded 100k+ event history with p95 < 150ms on `GET /stats` and `GET /review/next`, and a README with EXPLAIN ANALYZE before/after evidence.

## Out of Scope

- **Public deployment** — user decision: Docker/dockerfiles must work locally; no hosting setup.
- **Login/auth** — anonymous UUID users per the brief.
- **The 2-minute walkthrough video and "hours spent" number** — user records/fills these; README gets placeholders.
- **Quiz fill-in-the-blank direction** — brief marks it "a nice extra"; captured under Deferred Ideas.

## Approach

**Chosen:** Turborepo + Bun workspaces mirroring `~/Code/ravva` (develop) conventions with minimal tooling — `apps/api` (Hono on `@hono/node-server`, Node 22), `apps/web` (Vite + React 19 + Tailwind v4), `packages/shared` (zod API contracts), `packages/db` (schema.sql, PL/pgSQL functions, parser, seed, bench). Raw SQL via `postgres` (postgres.js) — **no ORM**: the deliverables (`schema.sql`, PL/pgSQL scheduler, EXPLAIN ANALYZE story) are SQL artifacts, and an ORM would hide exactly what is being scored. Analytics reads come from small rollup tables maintained inside the same PL/pgSQL ingest transaction (not materialized views — no refresh orchestration, always consistent, and gives a clean before/after EXPLAIN story vs aggregating raw events).
**Why:** Matches the user's stack directive and ravva conventions at minimum tooling cost; puts the scored logic (scheduler, idempotency, aggregation) in Postgres where the brief wants it.

## Context for Implementer

The brief's scoring is backend-weighted (75/100 on data/backend/scheduler/analytics/performance). Non-negotiables that cut across tasks: (1) the client never stores progress — every write goes through `POST /api/events` and every read reflects server state after reload; (2) every write is transactional AND idempotent — client-generated `event_id` UUID, enforced by a unique constraint inside one PL/pgSQL function; (3) scheduler logic lives in PL/pgSQL, not TypeScript; (4) mobile-first at 390px, 44px tap targets, AA contrast, right/wrong never shown by color alone, and empty/loading/error/finished states designed for every mode. Git: repo starts un-initialized — Task 1 runs `git init`; commit after each task with conventional-commit messages (user authorized incremental commits).

## Runtime Environment

- **Dev DB:** `docker compose up -d postgres` → Postgres 17 on `localhost:5432`, db/user/pass `vocab`/`vocab`/`vocab`.
- **Install / run:** `bun install`; `bun run db:setup` (schema + functions + word seed); `bun run dev` (turbo: api on `:3001`, web on `:3000`).
- **Health check:** `curl localhost:3001/healthz` → `{"ok":true}`.
- **Full app in Docker:** `docker compose up --build` → web on `localhost:8080` (Task 14).
- **Tests:** `bun run test` (turbo). API/db integration tests need the dev postgres container running; they create/reset a `vocab_test` database.

## File Structure

- `package.json` (create) — Bun workspaces (`apps/*`, `packages/*`), turbo/prettier/eslint scripts, `engines.node: 22.x`.
- `turbo.json` (create) — `build`/`dev`/`lint`/`test`/`check-types` pipelines.
- `eslint.config.mjs` (create) — single root ESLint 9 flat config (typescript-eslint + react + react-hooks + prettier-compat).
- `.prettierrc`, `.gitignore`, `.dockerignore`, `.env.example` (create).
- `docker-compose.yml` (create) — `postgres` (17-alpine, healthcheck) always; `api` + `web` services added in Task 14.
- `README.md` (create Task 1 stub, finalize Task 14) — all brief-required sections.
- `packages/db/` (create) — `schema.sql`, `functions.sql` (PL/pgSQL), `seed_words.sql` (generated, committed), `parse-report.json`, `src/parse-pdf.ts`, `src/migrate.ts`, `src/seed.ts`, `src/bench.ts`, `test/*.test.ts`.
- `packages/shared/` (create) — zod schemas + TS types for events, enums, API responses.
- `apps/api/` (create) — `src/index.ts` (serve), `src/app.ts` (Hono app), `src/db.ts` (postgres.js), `src/routes/{users,words,events,review,quiz,matching,game,stats}.ts`, `test/api.test.ts`, `Dockerfile`.
- `apps/web/` (create) — Vite + React 19 + Tailwind v4: `src/main.tsx`, `src/App.tsx` (router + lazy routes), `src/lib/{api.ts,user.ts}`, `src/routes/{home,learn,quiz,matching,game,stats}.tsx`, shared state components, `Dockerfile` + `nginx.conf`.

## Progress Tracking

- [x] Task 1: Monorepo scaffold, tooling, dev Postgres, git init
- [x] Task 2: PDF parser → committed `seed_words.sql` + parse report
- [x] Task 3: `schema.sql` — tables, constraints, indexes + migrate script
- [x] Task 4: PL/pgSQL — SM-2 `apply_review` + idempotent `record_event` ingest
- [ ] Task 5: PL/pgSQL — `review_next` scheduler + `rebuild_from_events`
- [ ] Task 6: Hono API — all endpoints + integration tests
- [ ] Task 7: Seed script (300 users / 100k+ events), bench, EXPLAIN evidence
- [ ] Task 8: Web shell — design foundation, router, anon user bootstrap
- [ ] Task 9: Learn mode
- [ ] Task 10: Quiz mode
- [ ] Task 11: Matching mode
- [ ] Task 12: Game mode — Word Rush
- [ ] Task 13: Stats dashboard
- [ ] Task 14: Dockerfiles + full compose + final README

## Implementation Tasks

### Task 1: Monorepo scaffold, tooling, dev Postgres, git init

**Objective:** Stand up the Turborepo/Bun workspace with minimal tooling mirroring ravva conventions, a dev Postgres 17 container, and an initialized git repo so every later task lands as a conventional commit. All four workspaces exist as compilable skeletons.

**Files:**

- Create: `package.json`, `turbo.json`, `eslint.config.mjs`, `.prettierrc`, `.gitignore`, `.dockerignore`, `.env.example`, `docker-compose.yml`, `README.md`
- Create: `packages/shared/{package.json,tsconfig.json,src/index.ts}`
- Create: `packages/db/{package.json,tsconfig.json,src/index.ts}`
- Create: `apps/api/{package.json,tsconfig.json,src/index.ts}`
- Create: `apps/web/` via Vite react-ts template + Tailwind v4 (`@tailwindcss/vite`)

**Key Decisions / Notes:**

- Mirror ravva root `package.json` shape (`/Users/willahelm/Code/ravva/package.json`): `packageManager: bun@1.3.x`, `engines.node: 22.x`, workspaces `apps/*`+`packages/*`, scripts `build/dev/lint/test/format/check-types` via turbo. NO husky/commitlint/lint-staged (user chose minimal tooling).
- Single root `eslint.config.mjs` flat config; per-package `lint` scripts point at it. Package scope `@vocab/*`.
- `docker-compose.yml`: `postgres:17-alpine`, port 5432, `POSTGRES_USER/PASSWORD/DB=vocab`, volume, `pg_isready` healthcheck — pattern from `/Users/willahelm/Code/ravva/docker-compose.yml`.
- Copy the two brief files' folder untouched; `.gitignore`: node_modules, dist, .env, .turbo, .DS_Store. `docs/plans/` stays committed (process evidence for graders who read history).
- `git init -b main`, commit `chore: scaffold turborepo monorepo (bun, hono api, vite web)`.

**Definition of Done:**

- [ ] `bun install` succeeds; all 4 workspaces build/typecheck as skeletons
- [ ] `docker compose up -d postgres` reports healthy
- [ ] `git log` shows the initial conventional commit
- [ ] Verify: `bun run lint && bun run check-types && docker compose ps`

### Task 2: PDF parser → committed `seed_words.sql` + parse report

**Objective:** A one-off script parses `Vocab Page - Amadeu/sat.vocab.pdf` (70 pages, ~1,047 POS-tagged senses, 56 multi-sense entries) into a committed Postgres seed file plus a machine-readable report of skipped entries and suspected bad data. The PDF is never parsed at app runtime.

**Files:**

- Create: `packages/db/src/parse-pdf.ts`
- Create: `packages/db/seed_words.sql` (generated output, committed)
- Create: `packages/db/parse-report.json` (generated, committed)
- Test: `packages/db/test/parse.test.ts`

**Key Decisions / Notes:**

- Extract text with `unpdf` (pdf.js wrapper, pure JS — keeps the repo self-contained; no poppler dependency).
- Normalization pipeline before entry parsing: ligatures (`ﬁ`→fi ×219, `ﬂ`→fl ×78), curly quotes/dashes → ASCII, strip repeated page furniture (`SAT Vocabulary` headers, standalone section letters), re-join words split across line breaks WITHOUT hyphens (observed: `har\ndy`, `haughty` split mid-word) by merging a line-final fragment with a line-initial lowercase fragment when the joined token + context matches the entry grammar.
- Entry grammar: `headword [1.] (pos.) definition (example) [2. (pos.) definition (example)]…` where pos ∈ {v., n., adj., adv.}. Emit one `words` row per headword and one `senses` row per sense with `sense_no`.
- POS-anomaly heuristics for the report (the brief says some POS labels are wrong): definition starts with `to ` but pos ≠ v.; starts with `one who`/`a `/`the ` but pos ≠ n. Report candidates as `pos_suspect`; do NOT silently rewrite — store label as printed, list suspects in report/README (graders asked for "bad data you found", not corrections).
- Unparseable entries: skip, count, list raw text in report. Deterministic output (stable ordering, no timestamps) so re-runs are diff-clean.
- Seed SQL: plain `INSERT INTO words/senses` statements with escaped strings; wrapped in one transaction.
- Test fixtures: inline text snippets covering multi-sense (`abide`), ligature word, split-word join, suspect-POS case, unparseable garbage → expected structured output. Expected values hand-derived from the PDF text, not from parser output.

**Definition of Done:**

- [ ] `seed_words.sql` contains ≥950 words and ≥1,000 senses; `abide`, `cleave`, `compound` each have ≥2 senses
- [ ] `parse-report.json` lists skipped count, skipped raw entries, pos_suspect candidates, AND a per-POS word count breakdown (feeds the Task 6 distractor-availability decision; the source PDF markers are ~489 adj / ~284 n / ~273 v / 1 adv, so `adv` will be scarce)
- [ ] Verify: `bun run --filter @vocab/db parse && bun run --filter @vocab/db test`

### Task 3: `schema.sql` — tables, constraints, indexes + migrate script

**Objective:** The complete Postgres schema as a readable, committed `schema.sql`: words, senses, users, progress, append-only events, and analytics rollup tables, with real constraints and the indexes the performance targets depend on. A migrate script applies schema + functions to any target database.

**Files:**

- Create: `packages/db/schema.sql`
- Create: `packages/db/src/migrate.ts` (applies `schema.sql` then `functions.sql` via postgres.js `file()`)
- Create: `apps/api/src/db.ts` (postgres.js client, `DATABASE_URL` from env)
- Test: `packages/db/test/schema.test.ts`

**Key Decisions / Notes:**

- Tables: `words(id int GENERATED ALWAYS AS IDENTITY PK, headword text UNIQUE NOT NULL)`; `senses(id identity PK, word_id FK ON DELETE CASCADE, sense_no smallint, pos text CHECK (pos IN ('v','n','adj','adv')), definition text NOT NULL, example text, UNIQUE(word_id, sense_no))`; `users(id uuid PK DEFAULT gen_random_uuid(), created_at timestamptz DEFAULT now())`; `events(id bigint identity PK, event_id uuid NOT NULL UNIQUE, user_id uuid FK, mode text CHECK (mode IN ('learn','quiz','matching','game')), type text CHECK (type IN ('revealed','rated','graded','matched','game_finished')), word_id int FK NULL, sense_id int FK NULL, correct boolean NULL, rating smallint NULL CHECK (rating BETWEEN 0 AND 5), payload jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now())` — append-only: no UPDATE/DELETE path in any function; `REVOKE UPDATE, DELETE ON events` from the app role documented in schema comments.
- `progress(user_id uuid, word_id int, ease numeric(4,2) NOT NULL DEFAULT 2.50, interval_days integer NOT NULL DEFAULT 0, repetitions integer NOT NULL DEFAULT 0, due_at timestamptz NOT NULL DEFAULT now(), mastered_at timestamptz NULL, correct_count int NOT NULL DEFAULT 0, miss_count int NOT NULL DEFAULT 0, last_reviewed_at timestamptz, PRIMARY KEY (user_id, word_id))`.
- Rollups: `user_daily_stats(user_id, day date, reviews int, correct int, mastered int, PRIMARY KEY(user_id, day))`; `user_mode_stats(user_id, mode text, attempts int, correct int, PRIMARY KEY(user_id, mode))`. Days are UTC (documented in README).
- Indexes: `events(user_id, created_at)`; `progress(user_id, due_at)` (drives `review_next`); `senses(word_id)`; `senses(pos)` (quiz distractors). `events.event_id` unique index IS the idempotency mechanism.
- Migrate is apply-on-fresh (seed/tests own reset via `DROP SCHEMA public CASCADE; CREATE SCHEMA public` in dedicated dbs); no migration framework — `schema.sql` is the single source of truth the graders asked for.
- Test: applies to a fresh `vocab_test` db; asserts duplicate `event_id` insert fails, rating=7 rejected, senses cascade on word delete.

**Definition of Done:**

- [ ] `migrate` applies cleanly to a fresh database; second apply to another fresh db also clean
- [ ] Constraint tests pass (dup event_id, rating range, FK cascade)
- [ ] Verify: `bun run --filter @vocab/db migrate && bun run --filter @vocab/db test`

### Task 4: PL/pgSQL — SM-2 `apply_review` + idempotent `record_event` ingest

**Objective:** The write path lives entirely in Postgres: one `record_event(...)` function inserts the event, short-circuits duplicates via the `event_id` unique constraint, applies SM-2 to `progress`, and maintains both rollup tables — all in a single transaction. This is the function every API write calls.

**Files:**

- Create: `packages/db/functions.sql`
- Test: `packages/db/test/sm2.test.ts`

**Key Decisions / Notes:**

- `apply_review(p_user uuid, p_word int, p_quality int)` — SM-2: `ease' = GREATEST(1.3, ease + (0.1 - (5-q)*(0.08+(5-q)*0.02)))`; q < 3 → `repetitions=0, interval_days=0, due_at=now()+interval '10 minutes'`; q ≥ 3 → repetitions++, interval 1 → 6 → `round(interval*ease)` days, `due_at = now() + interval_days`. Mastered when `interval_days >= 21` (Anki "mature" convention): set `mastered_at` once; a later q<3 clears it AND decrements `user_daily_stats.mastered` for `date(mastered_at)` — the ORIGINAL mastery day, not the miss day (capture the date before nulling) — so the mastery-over-time chart stays internally consistent.
- `record_event(p_event_id uuid, p_user uuid, p_mode text, p_type text, p_word int, p_sense int, p_correct bool, p_rating int, p_payload jsonb) RETURNS jsonb` — `INSERT … ON CONFLICT (event_id) DO NOTHING`; when no row inserted, return `{"duplicate": true}` untouched-state; otherwise map quality and update progress + rollups, return new progress for the word.
- Quality mapping lives ONLY here: `rated` events use `p_rating` as-is (Learn buttons Again/Hard/Good/Easy → 1/3/4/5); `graded`/`matched` events map correct→4, incorrect→1; `revealed`/`game_finished` record the event but skip `apply_review`.
- Rollup maintenance: upsert `user_daily_stats(reviews+1, correct+?, mastered±?)` and `user_mode_stats(attempts+1, correct+?)` for scoring events only.
- Tests (vitest against `vocab_test`): (a) same `event_id` twice → 1 events row, progress and rollups byte-identical after 2nd call; (b) SM-2 trajectory for quality sequence 5,5,5 → ease 2.6/2.7/2.8, intervals 1/6/17 (round(6 x 2.8)) → hand-computed expected values from the SM-2 spec, independent of the implementation; (c) q=2 resets repetitions and interval; (d) ease floors at 1.3; (e) mastery set at interval ≥21 and cleared on later miss; (f) the mastery decrement targets the ORIGINAL `date(mastered_at)` day's rollup row, not the miss day.

**Definition of Done:**

- [ ] Duplicate `event_id` is a no-op returning `duplicate: true`
- [ ] SM-2 trajectory matches hand-computed SM-2 values (ease, interval, due_at)
- [ ] Rollups update only on scoring events and never double-count
- [ ] Verify: `bun run --filter @vocab/db test`

### Task 5: PL/pgSQL — `review_next` scheduler + `rebuild_from_events`

**Objective:** The database decides what to study: `review_next` returns the next batch of due words (overdue first, then new words) for a user, fast at scale. `rebuild_from_events` replays the append-only event log through the same SM-2 logic to reconstruct all derived state — used by the seed for speed and proving events are the source of truth.

**Files:**

- Modify: `packages/db/functions.sql`
- Test: `packages/db/test/review.test.ts`

**Key Decisions / Notes:**

- `review_next(p_user uuid, p_limit int DEFAULT 10) RETURNS TABLE(word_id, headword, senses jsonb, reason text, due_at timestamptz)` — UNION of: (1) due rows from `progress` where `due_at <= now()`, ordered by `due_at` ASC with miss-heavy words boosted (`ORDER BY (miss_count::float / GREATEST(correct_count+miss_count,1)) DESC, due_at ASC` — ties the "hardest words come up sooner" analytics requirement into the scheduler); (2) new words (anti-join on progress) in id order, filling the remainder. Senses aggregated as jsonb per word. Uses the `progress(user_id, due_at)` index; the anti-join is bounded by ~1k words.
- `rebuild_from_events()` — truncate `progress` + rollups, loop events in `(created_at, id)` order calling the same internal apply logic as `record_event`. One function call replays 100k+ events server-side in seconds (no per-event network round-trips).
- Equivalence test: generate ~500 random events; path A = incremental `record_event` calls; path B = raw event COPY + `rebuild_from_events()`; final `progress` + rollup tables must be identical. This is the strongest correctness proof in the repo — it pins ingest and replay to the same semantics.

**Definition of Done:**

- [ ] Due words returned before new words; overdue miss-heavy words rank first; batch fills with new words for a fresh user
- [ ] `rebuild_from_events` state ≡ incremental `record_event` state on the same event sequence
- [ ] Verify: `bun run --filter @vocab/db test`

### Task 6: Hono API — all endpoints + integration tests

**Objective:** The HTTP surface the client exclusively reads/writes through: user bootstrap, the full word list with per-user progress, the single event write path, the scheduler batch, server-built Quiz/Matching/Game payloads, stats, and a health check. Zod-validated at the edge with contracts shared from `packages/shared`.

**Files:**

- Create: `apps/api/src/app.ts`, `apps/api/src/index.ts` (`@hono/node-server`, port `API_PORT` default 3001)
- Create: `apps/api/src/routes/users.ts`, `words.ts`, `events.ts`, `review.ts`, `quiz.ts`, `matching.ts`, `game.ts`, `stats.ts`
- Modify: `packages/shared/src/index.ts` (zod: event schema, enums, response types)
- Test: `apps/api/test/api.test.ts`

**Key Decisions / Notes:**

- Endpoints: `POST /api/users` → `{id}`; `GET /api/words?user_id` → all words + senses + per-user progress status (`new|learning|mastered`, one query, joined) — client caches and searches locally; `POST /api/events` (zod: `event_id` uuid required) → calls `record_event`, returns `{duplicate, progress}`; `GET /api/review/next?user_id&limit` → `review_next`; `GET /api/quiz/next?user_id&direction=w2d|d2w&count=10&exclude=ids` → questions with 3 distractors sampled from same-POS senses of OTHER words (SQL, excludes all senses of the answer word — multi-sense words must not appear as their own distractor). Distractor-availability rule (the PDF has only 1 `adv` marker): when a POS has < 4 words, fall back to cross-POS distractors and flag the question `pos_relaxed: true` — never fewer than 4 options, never a crash; `GET /api/matching/next?user_id` → 6–8 pairs (due/hard-first via `review_next`, deduped by word — never two senses of one word in a grid); `GET /api/game/next?user_id&count=30` → judgment feed: 50/50 true pair vs decoy (same-POS definition from another word), each with `is_match`; `GET /api/stats?user_id` → `{mastery_over_time (last 30 UTC days), streak, hardest (top 10 by per-user miss rate, min 3 attempts), modes}` — all read from rollups/progress, zero raw-event scans; `GET /healthz`.
- Streak = consecutive UTC days ending today-or-yesterday with `reviews > 0` in `user_daily_stats` (documented in README as a study streak).
- Errors: JSON `{error}` with 400 (validation), 404 (unknown user/word), 500; CORS allows web dev origin.
- Integration tests (vitest + `app.request()` against `vocab_test`): double-POST same `event_id` → second returns `duplicate: true` and attempts don't change; quiz options same POS + exclude answer word's senses + no repeats with `exclude`; review/next shape; stats shape + values for a scripted event sequence (expected numbers hand-computed); 400 on missing `event_id`.

**Definition of Done:**

- [ ] All endpoints respond with documented shapes; validation rejects malformed writes
- [ ] Idempotency proven end-to-end over HTTP (double-send test)
- [ ] Quiz distractors: same POS, never the answer word's own senses, no duplicate options
- [ ] Verify: `bun run --filter @vocab/api test`

### Task 7: Seed script (300 users / 100k+ events), bench, EXPLAIN evidence

**Objective:** One command produces the graders' test environment: schema + functions applied, ~1,000 words seeded, 300 users with ≥100,000 realistic practice events replayed into derived state, statistics ANALYZEd — then a bench script proves `GET /stats` and `GET /review/next` meet p95 < 150ms, and EXPLAIN ANALYZE before/after outputs are captured for the README.

**Files:**

- Create: `packages/db/src/seed.ts` (wired as `bun run db:seed` at root)
- Create: `packages/db/src/bench.ts`
- Create: `packages/db/explain/` (captured EXPLAIN ANALYZE outputs, committed)

**Key Decisions / Notes:**

- Seed: reset target db → apply `schema.sql` + `functions.sql` → run `seed_words.sql` → insert 300 users → generate events with a SEEDED PRNG (deterministic reruns): 60 days of history, zipf-ish word popularity, per-user session bursts, mode mix (~50% learn/quiz, ~25% matching, ~25% game), per-user accuracy 60–90% — stream via `COPY` into `events` → `SELECT rebuild_from_events()` → `ANALYZE`. Target < 2 minutes total.
- Bench: boots the Hono app IN-PROCESS (imports `apps/api` `app.ts`, listens on an ephemeral port) so the DoD command is self-contained — no separately running dev server required; warm up, then ~200 requests each across random seeded users; report p50/p95/p99; exit non-zero if p95 ≥ 150ms. Document machine + methodology in README.
- EXPLAIN evidence (the brief scores this): capture `EXPLAIN ANALYZE` for (a) stats computed from raw `events` aggregation — the "before" — vs rollup-table reads — the "after"; (b) `review_next` core query with a seq scan (index dropped in a scratch session) vs with `progress(user_id, due_at)` — save raw outputs to `packages/db/explain/*.txt` for the README's before/after section with one-sentence explanations.

**Definition of Done:**

- [ ] `bun run db:seed` completes on a fresh container with ≥100k events, 300 users, deterministic across reruns
- [ ] `bun run --filter @vocab/db bench` reports p95 < 150ms for both endpoints against seeded data
- [ ] `packages/db/explain/` holds before/after outputs for both endpoints
- [ ] Verify: `bun run db:seed && bun run --filter @vocab/db bench`

### Task 8: Web shell — design foundation, router, anon user bootstrap

**Objective:** The app frame everything else plugs into: mobile-first layout (390px), bottom navigation with 44px targets, an AA-contrast token palette defined once, lazy-loaded routes for <3s interactivity, TanStack Query for server state with shared loading/error/empty components, and anonymous-user bootstrap (localStorage UUID as identity cache only — all progress server-side).

**Files:**

- Modify: `apps/web/src/main.tsx`, `apps/web/src/App.tsx` (React Router, `React.lazy` routes)
- Create: `apps/web/src/lib/api.ts` (typed fetch wrapper using `@vocab/shared`), `apps/web/src/lib/user.ts` (get-or-create UUID, `POST /api/users` on first run)
- Create: `apps/web/src/components/{Layout,BottomNav,States}.tsx` (`States` = Loading/Error/Empty patterns reused by all modes)
- Create: `apps/web/src/routes/home.tsx` (mode cards + streak chip from `/api/stats`)
- Create: `apps/web/src/styles/theme.css` (Tailwind v4 `@theme` tokens)

**Key Decisions / Notes:**

- Add deps: `react-router-dom`, `@tanstack/react-query` (uniform caching + loading/error states — the "states and edge cases" scoring line), later `@tanstack/react-virtual` (Task 9).
- Token palette checked for AA at definition time (4.5:1 body text); correctness feedback pairs icon+label with color everywhere (pattern established in `States`/feedback components).
- No horizontal scroll: `overflow-x` guarded at layout root; all interactive elements min 44×44px via a shared class.
- Home shows the four mode cards + streak; empty-stats users get a friendly zero state.

**Definition of Done:**

- [ ] App boots at 390px with bottom nav, no horizontal scroll, all 5 routes lazy-load
- [ ] First visit creates + persists a user; API receives it (`users` row exists)
- [ ] Verify: `bun run --filter @vocab/web build` + browser check at 390px

### Task 9: Learn mode

**Objective:** Every one of the ~1,000 words reachable in a virtualized list with instant client-side search and filters; definitions hidden until revealed; a reveal is recorded and a self-rating (Again/Hard/Good/Easy) is written through the API and reflected after reload; fully keyboard-operable on desktop.

**Files:**

- Create: `apps/web/src/routes/learn.tsx`
- Create: `apps/web/src/components/learn/{WordRow,WordCard,RatingBar,FilterChips}.tsx`

**Key Decisions / Notes:**

- `@tanstack/react-virtual` over the cached `GET /api/words` list (~1k rows, one fetch). Search = client-side substring over headword+definitions (in-memory, well under 100ms); filters: POS + status (`new|learning|mastered`) chips.
- Row → expandable card: definitions hidden by default; reveal sends `{type:'revealed'}` event; rating buttons send `{type:'rated', rating: 1|3|4|5}`; TanStack Query mutation updates cache from the `progress` the API returns (server truth, no client-derived mastery).
- Keyboard: `↑/↓` moves focus, `Enter`/`Space` reveals, `1–4` rates the open card; visible focus rings; `aria-expanded` on rows.
- Mastery badge (icon + label, not color-only) per row from server status; deep-link `?word=` scrolls/opens that word (used by Quiz results).

**Definition of Done:**

- [ ] All words reachable by scroll; search + filters work instantly
- [ ] Reveal + rating persist: after reload, rated word shows server-stored status (TS-001)
- [ ] Keyboard-only flow works (TS-008)
- [ ] Verify: browser TS-001/TS-008 + `bun run --filter @vocab/web build`

### Task 10: Quiz mode

**Objective:** Multiple-choice quiz in both directions (word→definition, definition→word) with believable same-POS distractors, no repeated word within a session, immediate non-color-only feedback, every answer written as a graded event, and a results screen listing missed words with links straight into Learn.

**Files:**

- Create: `apps/web/src/routes/quiz.tsx`
- Create: `apps/web/src/components/quiz/{QuizCard,Results}.tsx`

**Key Decisions / Notes:**

- Direction picker on entry; session pulls `GET /api/quiz/next` batches, passing accumulated `exclude` ids — server guarantees option quality (Task 6), client guarantees no-repeat by tracking asked word ids for the session.
- Answer → lock options, show ✓/✗ icon + "Correct"/"Not quite" text + highlight the right answer; send `{type:'graded', correct}`; auto-advance after a beat.
- Results: score, per-question review of misses, each missed word links to `/learn?word=<id>`; "Study missed words" primary action; finished state doubles as the session end screen.
- 10 questions per session (fits "playable quickly"); loading/error states via shared `States`. Scarce-POS questions arrive with `pos_relaxed: true` from the API (Task 6 rule) — no client-side guard logic needed.

**Definition of Done:**

- [ ] Both directions work; no word repeats within a session; options believable (same POS)
- [ ] Missed-word links open Learn focused on that word (TS-003)
- [ ] Graded events appear in stats attempt counts
- [ ] Verify: browser TS-003 + `bun run --filter @vocab/web build`

### Task 11: Matching mode

**Objective:** A 6–8 pair word↔definition grid where pairing works by clicking AND by dragging, both with mouse and touch (drag that only works with a mouse is an automatic fail), with clear non-color right/wrong feedback, laid out to survive the longest definitions on a 390px screen.

**Files:**

- Create: `apps/web/src/routes/matching.tsx`
- Create: `apps/web/src/components/matching/{MatchBoard,MatchTile}.tsx`

**Key Decisions / Notes:**

- Interaction is hand-rolled Pointer Events (no dnd lib): `pointerdown` + `setPointerCapture` + move threshold distinguishes tap-select from drag; drop target resolved via `document.elementFromPoint`; `touch-action: none` on tiles. Tap path: select word tile → tap definition tile. Both paths share one `attemptPair()`.
- Correct pair → tiles lock with ✓ + dimmed; wrong → shake animation + ✗ label, selection clears. Every attempt sends `{type:'matched', correct}` per pair.
- Grid = two columns (words | definitions) at 390px; definition tiles auto-height with `line-clamp` + tap-to-expand for the longest definitions (stress-test with the seeded maximum-length definition, per the brief).
- Board fetched from `GET /api/matching/next` (due/hard-first, word-deduped server-side); completing all pairs → finished state with accuracy + "play again".

**Definition of Done:**

- [ ] Click-pairing and drag-pairing both work under touch emulation and mouse (TS-004)
- [ ] Longest seeded definition renders without overflow or horizontal scroll at 390px
- [ ] Per-pair events recorded; finished state reachable
- [ ] Verify: browser TS-004 + `bun run --filter @vocab/web build`

### Task 12: Game mode — Word Rush

**Objective:** The invented game: a word + candidate definition appear; the player swipes right if they match, left if they don't (buttons as fallback), against a 90-second timer with a streak multiplier. Clearly different from Quiz (binary recognition vs 4-option recall), one-thumb playable, has a score and an end, and cannot be won without reading definitions.

**Files:**

- Create: `apps/web/src/routes/game.tsx`
- Create: `apps/web/src/components/game/{RushCard,GameOver}.tsx`

**Key Decisions / Notes:**

- Feed from `GET /api/game/next` (50/50 true/decoy, same-POS decoys — reading is mandatory since decoys are plausible). Swipe via Pointer Events with rotation/translate feedback + ✓/✗ zones labeled with text; two 44px buttons ("Match" / "No match") mirror the gesture for accessibility.
- Scoring: correct = 10 × current multiplier (multiplier +1 every 5-streak, cap ×4); wrong = streak reset. 90s countdown always ends the game → GameOver: score, best streak, accuracy, missed pairs list linking to Learn, replay button.
- Each judgment sends `{mode:'game', type:'graded', correct}` (feeds SM-2 + stats like any review); game end sends `{type:'game_finished', payload:{score}}`.
- README "Why this game" note (drafted here, lands in Task 14): binary recognition at speed = high-volume retrieval practice complementing Quiz's recall; rejected: falling-words (arcade cost, weak on small screens), boss battle (mechanically a re-skinned quiz).

**Definition of Done:**

- [ ] Full 90s run playable one-thumb at 390px; score + multiplier + end screen work
- [ ] Judgments and game_finished events recorded (visible in stats)
- [ ] Verify: browser TS-005 + `bun run --filter @vocab/web build`

### Task 13: Stats dashboard

**Objective:** An in-app dashboard rendering `GET /api/stats`: words mastered per day (last 30 days), current streak, hardest words by miss rate, and accuracy/attempts by mode — straight from SQL aggregates, with real loading/error/empty states.

**Files:**

- Create: `apps/web/src/routes/stats.tsx`
- Create: `apps/web/src/components/stats/{MasteryChart,HardestWords,ModeAccuracy}.tsx`

**Key Decisions / Notes:**

- Charts as small inline SVG (bar chart for mastery/day, stat tiles for streak/accuracy) — no chart library for four small visuals; consult the dataviz skill before writing chart code per its trigger.
- Hardest words table: word, miss rate, attempts; each row links to Learn. Mode accuracy as labeled bars with numbers (never color-only encoding).
- Fresh user → friendly empty state pointing at the modes; loading skeleton; error state with retry.

**Definition of Done:**

- [ ] Seeded user shows populated chart, streak, hardest table, mode accuracy matching API numbers
- [ ] Fresh user sees the designed empty state (TS-006)
- [ ] Verify: browser TS-006 + `bun run --filter @vocab/web build`

### Task 14: Dockerfiles + full compose + final README

**Objective:** `docker compose up --build` runs the entire product (Postgres + API + web) locally, and the README delivers everything the brief demands: setup, architecture paragraph, SM-2 explanation, "Why this game", parsing notes with the bad-data list, before/after EXPLAIN ANALYZE, and placeholders for hours spent + video link.

**Files:**

- Create: `apps/api/Dockerfile` (multi-stage: bun install + tsc build → `node:22-alpine` runtime running `dist/`)
- Create: `apps/web/Dockerfile` (build → `nginx:alpine`), `apps/web/nginx.conf` (static + `/api` proxy to api)
- Modify: `docker-compose.yml` (add `api` + `web` services, healthcheck-gated startup; web on `localhost:8080`), `.dockerignore`
- Modify: `README.md`

**Key Decisions / Notes:**

- API container runs plain Node (user directive: Node runtime), built once in the bun stage; `DATABASE_URL` points at the compose postgres; api waits on postgres health. Seeding is COMMITTED to Docker: a one-shot `seed` compose service (api image, `depends_on: postgres: condition: service_healthy`, runs the built seed entry) so `docker compose run --rm seed` works with zero host toolchain; `bun run db:seed` remains the documented dev-loop equivalent.
- README structure: quickstart (compose + seeded path), architecture paragraph (monorepo map + "backend owns all state"), scheduler section (SM-2 formulas + mastery rule + why), "Why this game", parsing notes (counts, skipped list, pos_suspect list, normalization pipeline), performance section (bench methodology + p95 table + EXPLAIN before/after with one-sentence explanations), hours-spent + video placeholders for the user.
- Final pass: run the full test suite + bench + a browser smoke over all four modes at 390px.

**Definition of Done:**

- [ ] `docker compose up --build` serves the working app at `localhost:8080` against containerized api + postgres
- [ ] `docker compose run --rm seed` seeds the containerized database with no host Bun/Node needed
- [ ] README contains every brief-required section (checklist above) with real captured outputs, including a parsing-notes line that the word count (~1,000 headwords / ~1,047 senses) is derived from the source PDF, not a fixed target
- [ ] Verify: `docker compose up --build -d && curl localhost:8080 && curl localhost:3001/healthz` + browser smoke

## E2E Test Scenarios

### TS-001: Learn — reveal, rate, persist
**Priority:** Critical
**Preconditions:** Seeded DB, fresh browser profile (new anon user)
**Mapped Tasks:** Task 8, 9

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/learn` | Virtualized word list renders; definitions hidden |
| 2 | Type "abate" in search | List filters to abate within 100ms |
| 3 | Click the row, click reveal | Definition + example appear; rating buttons show |
| 4 | Click "Good" | Status badge updates (icon + label) |
| 5 | Reload the page, search "abate" | Word shows the server-stored status — not "new" |

### TS-002: Cross-mode consistency
**Priority:** Critical
**Preconditions:** TS-001 state (rated word exists)
**Mapped Tasks:** Task 4, 6, 9, 10

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Complete a quiz answering "abate" correctly | Graded feedback shown |
| 2 | Navigate to `/learn`, search "abate" | Progress reflects the quiz answer (updated status/attempts) after reload |

### TS-003: Quiz session + results links
**Priority:** Critical
**Preconditions:** Seeded DB
**Mapped Tasks:** Task 10

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open `/quiz`, pick "definition → word" | First question with 4 options, all same POS |
| 2 | Answer 10 questions, at least one wrong | Feedback each time: icon + text, correct answer highlighted; no word repeats |
| 3 | Reach results screen | Score + missed words listed |
| 4 | Click a missed word | Learn opens focused on that word |

### TS-004: Matching — click and drag, touch
**Priority:** Critical
**Preconditions:** Seeded DB; run once with touch emulation, once with mouse
**Mapped Tasks:** Task 11

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open `/matching` | 6–8 word and definition tiles, no overflow at 390px |
| 2 | Tap a word, tap its definition | Pair locks with ✓ feedback |
| 3 | Drag a word onto a wrong definition (touch) | Shake + ✗ text; selection clears |
| 4 | Drag a word onto its definition (touch) | Pair locks — drag works without a mouse |
| 5 | Complete all pairs | Finished state with accuracy + play again |

### TS-005: Game — Word Rush full run
**Priority:** High
**Preconditions:** Seeded DB
**Mapped Tasks:** Task 12

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open `/game`, start | Word + definition card, timer counts down from 90s |
| 2 | Swipe right on a true pair | Score increases; streak increments |
| 3 | Swipe wrong on purpose | ✗ feedback + streak resets; score rules applied |
| 4 | Let timer expire (or fast-forward) | Game-over screen: score, streak, missed list, replay |

### TS-006: Stats dashboard
**Priority:** High
**Preconditions:** Seeded DB (100k events)
**Mapped Tasks:** Task 13

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open `/stats` as a seeded user (set localStorage user to a seeded id) | Mastery chart, streak, hardest words, mode accuracy all populated |
| 2 | Open `/stats` as a brand-new user | Designed empty state, no blank page |

### TS-007: Mobile 390px sweep
**Priority:** Critical
**Preconditions:** Viewport 390×844
**Mapped Tasks:** Task 8–13

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Visit home, learn, quiz, matching, game, stats | No horizontal scroll anywhere; interactive targets ≥44px |
| 2 | Check feedback moments in each mode | Right/wrong always icon/text + color, never color alone |

### TS-008: Learn keyboard navigation
**Priority:** Medium
**Preconditions:** Desktop viewport
**Mapped Tasks:** Task 9

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tab into the word list, press ↓ ↓ | Focus moves rows with visible focus ring |
| 2 | Press Enter | Card reveals definition |
| 3 | Press 3 | "Good" rating submitted; badge updates |

## Deferred Ideas

- Quiz fill-in-the-blank from example sentences (brief's "nice extra") — add after everything else is green if time allows.
