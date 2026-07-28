# Aurea Design Implementation Plan

Created: 2026-07-28
Author: jacob@evren.gg
Agent: Claude Code
Status: VERIFIED
Approved: Yes
Iterations: 1
Worktree: No
Type: Feature

## Summary

**Goal:** Rebuild all six `apps/web` screens on the Aurea design system — new light/dark token layer, icon bottom nav, reward layer (XP, 12 levels, 13 badges, daily goal, streak flames, celebration sheets), and the full loading/empty/error/offline/finished state set — with every motion honouring `prefers-reduced-motion`.

## Out of Scope

- **No backend, schema, or API change.** Every reward value is a pure function of the existing `GET /api/stats` payload plus per-run game state. `packages/db`, `apps/api`, and `packages/shared` are untouched.
- **The Aurea `_ds` kit is not imported.** `_ds_bundle.js`/`_ds_bundle.css` are a generic shadcn/Radix library (48 components) that the design canvas links but the mockups do not use — every mockup is inline-styled against its own `:root`. Porting the kit would add Radix + 48 components for nothing. `styles.css` is one line (`@import "./_ds_bundle.css"`). `support.js` is the canvas runtime shim (`<x-dc>`, `<sc-for>`, `{{ }}`, `style-active=`) — its *values* matter, the runtime does not.
- **No new runtime dependency.** Charts stay inline SVG, icons stay inline SVG paths taken from the mockups, animations stay CSS. `vitest` is added to `apps/web` as a devDependency only.
- **No "You" / profile route.** Badges live on Progress; level detail lives on Home.

## Approach

**Chosen:** Rewrite `apps/web/src` against a token layer pasted from the design's own `@theme` block, with a shared `components/ui/` primitive set and a pure `lib/rewards.ts` engine.

**Why:** The design ships a ready-to-paste Tailwind v4 `@theme` block plus a `.dark` override, so the token layer is transcription rather than interpretation — and once tokens and primitives exist, each screen is a contained rewrite. The cost is that all six routes change at once, so nothing is verifiable until the shell lands (Tasks 1–6 build the floor; 7–12 are independent screens on top of it). The rejected alternative was re-skinning screens in place without a primitive layer: cheaper per screen, but the button/chip/ring specs would be re-derived six times and drift.

## Context for Implementer

**The design canvas is only reachable from the main conversation.** `DesignSync` is not in any subagent's tool allowlist and no design MCP is registered in `.mcp.json` — three exploration subagents failed on exactly this. Task 1 therefore exports the whole project to `docs/design/` first; every later task reads its screen file off disk (`Read` with `offset`/`limit`, or `python3` slicing — the files are 30–90 KB and exceed the single-read token cap).

`.dc.html` files are design-canvas documents. `<sc-for list="{{ x }}" as="y">` blocks and `{{ mustache }}` bindings are scaffolding; the **real data lives in the trailing `<script type="text/x-dc">` block** (level curve, badge table, copy strings, motion table). Read that block first for any screen — it is the spec. The `.dv-turn`/`.dv-opt`/`.dv-card` chrome is the mockup document's own presentation: never port it.

Two tokens the `@theme` block omits but the States mockup requires: `--color-shim` (skeleton highlight) and `--color-on-accent` (text on accent fills). In dark, `--color-accent` is `#2fd6bf` — **`text-white` on `bg-accent` fails AA there**, so every current `text-white` on an accent surface becomes `text-on-accent`.

## Runtime Environment

All three services are already up and healthy (verified: `docker compose ps`, `curl /healthz` → 200).

- **API** `:3001` — `bun apps/api/src/index.ts`, health `GET /healthz`
- **Web (vite dev, HMR)** `:3000` — `bun run --filter @vocab/web dev`; both are `.claude/launch.json` entries, so start via `preview_start {name:"web"}`
- **Web (docker nginx, prod bundle)** `:8080` — only rebuild via `docker compose up --build -d web` if the prod path needs checking
- Postgres `:5434`, seeded (300 users / 120k events)

## Assumptions

- The seeded anonymous user in the browser's `localStorage` has enough history to render populated states. If it does not, clearing `vocab.user_id` mints a fresh user for zero-state checks — Tasks 7 and 12 need both.
- **`mastery_over_time` is windowed to the trailing 30 UTC days** (`apps/api/src/routes/stats.ts` — `day > (now() AT TIME ZONE 'utc')::date - 30`), so any XP term summed from it *shrinks* as active days age out. Only `totals` and `modes[]` are lifetime-stable. Task 2 depends on this; Tasks 7 and 12 display what it produces.
- **`modes[]` includes a `learn` row.** `record_event` calls `ingest_scored_action(p_user, p_mode, …)` for every scored action including `rated` (`packages/db/functions.sql:134`), so `modes[mode='learn'].attempts` is the lifetime count of words rated in Learn, and its `correct` counts ratings of quality ≥ 3. Tasks 2 and 7 depend on this.

## Autonomous Decisions

- **`docs/design/` is gitignored**, matching the existing treatment of `docs/design-prompts.md`. It is ~500 KB of generated canvas HTML — local reference material, not repo evidence.
- **Lifetime XP and session XP are two different numbers.** The design's XP source table mixes lifetime-stable fields with per-day ones. Folding the per-day terms into the level-driving total would make XP fall as days roll out of the 30-day window. So the *level driver* uses only lifetime-stable fields, and the per-day terms (+30 goal met, +50 every seventh streak day, Word Rush `score ÷ 4`) surface as **session XP** on session-end screens — which is where the design shows them anyway ("+340 XP this session"). Every value in the design's table still appears in the UI; only the accumulator is restricted.
- **Streak number stays the server's `streak`.** The design's "grace day" rule (one zero-day inside an otherwise complete week reads through) is used *only* for the at-risk nudge copy ("a grace day would carry the run"), never to display a second, larger streak number that contradicts the API.
- **Daily goal never auto-raises.** `clamp(median(last 14 active days' reviews), 8, 20)`, default 10 with no history; persisted in `localStorage`. A newly computed goal that is *lower* applies immediately (the design's "goal can shrink" rule); a higher one does not apply without an explicit tap.
- **Word Rush personal best is device-local.** `StatsDto` carries no score history and there is no read endpoint for `game_finished` payloads, so best-score comparison reads from `localStorage` and is labelled "your best on this device". Marked with a `SHORTCUT:` comment naming the upgrade trigger (add `best_score` to `StatsDto` if cross-device matters).
- **Badge-unlock celebrations are seeded silently on first computation** — a returning user with 6 earned badges does not get 6 sheets. Only a badge that transitions locked→earned *within the session* celebrates.

## Deviations

- **Task 1 also made the dev-server port overridable** (`apps/web/vite.config.ts` `server.port = Number(process.env.PORT) || 3000`, `"dev": "vite"` in `apps/web/package.json`, `"autoPort": true` in `.claude/launch.json`). Port 3000 was already held by another session's dev server, so no browser verification was possible at all without this. The documented default is unchanged at 3000.
- **Task 1 uses `@theme static`, not `@theme`.** Tailwind v4 tree-shakes unused theme variables off `:root`; the design's inline SVGs reference tokens as `stroke="var(--color-gold)"`, which the class scanner cannot see, so `--color-xp`, `--color-gold` and friends resolved to nothing in light mode. Verified before/after in the browser: 0 of 22 colour tokens missing in either theme, 22 of 22 flip on `.dark`.
- **Learn's deep link was broken by Task 4's own skeleton floor, found by TS-005 and fixed in Task 9.** The `?word=` handler ran while the 400ms `useMinimumDuration` skeleton still owned the viewport, so `scrollRef` was null - it scrolled nowhere and then cleared the param, so it never retried. It now waits for the list to mount and sets the offset on the element directly (`getOffsetForIndex`), because `virtualizer.scrollToIndex` no-ops until the virtualizer has measured its scroll element. Verified: `/learn?word=212` lands on `clergy`, open and on screen.
- **Task 9 (Quiz) replaced the auto-advance timer with an explicit Continue button.** The plan said to keep the 900 ms / 1700 ms auto-advance; the Quiz mockup (variant 3a) instead locks the options and shows a feedback bar with a `Continue` / `See results` button, driven by Enter/Space. The design's version is both what was asked for and the more accessible one, so it wins.

- **Scroll was broken wherever the page overflowed, reported by the user mid-build.** `overflow-x: hidden` on both `html` and `body` forces `overflow-y` to compute to `auto`, making body a scroll container with nothing to scroll: it swallowed the wheel instead of chaining to the document, so the page only moved when the pointer was over the fixed bottom nav. Now `overflow-x: clip` on `html` only, which creates no scroll container.
- **Verification was paused at the user's request during Task 11, then resumed for the cross-cutting truths.** Progress (TS-008) and both cross-screen Goal Verification truths are browser-verified. TS-007 step 4 - the last-ten-seconds HUD escalation - was the last gap: two manual attempts missed the ten-second window entirely. It is now closed by a scripted full 90-second run, sampled at 9.2s / 7.6s / 6.1s left, in both motion modes. All three signals fire together: solid flame fill (`rgb(194,65,12)`) with `--color-on-flame` text, tenths on the clock, `animate-urgent`, and the progress bar flipping to flame. Under `prefers-reduced-motion: reduce` the fill and the tenths are identical and only the pulse is neutralised by the global 1ms guard - which is the point of carrying three signals.
- **The streak nudge made the bottom nav untappable, found while recording the README walkthrough.** Its wrapper clears the nav with `pb-[calc(4.5rem+safe-area)]` inside its own `fixed bottom-0` box at `z-30`, so the padding sat over the nav and swallowed every tap on it - Home was unnavigable whenever a streak was at risk. `pointer-events-none` on the wrapper, `pointer-events-auto` on the card. Verified: nudge on screen, tap Learn, lands on `/learn`.
- **The `--color-warn` value from the design fails AA in light.** #a16207 on #fef3c7 is 4.42:1, under the 4.5 needed by the "Learning" status chip and Home's accuracy chip. Lowered to #854d0e (6.2:1), same amber reading. Found by the all-routes contrast sweep, not by eye.
- **The 30-day chart flattened under one outlier day.** Scaling bar height against the outright max meant a single heavy session (a 130-judgment Word Rush run) pushed every other day to the 3px floor and the month read as empty. Now scaled against the 90th percentile of active days, with heights clamped, so the outlier still draws full height but no longer sets the scale.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| XP recomputed per load drifts backwards as `mastery_over_time` days roll out of the 30-day window, or as a lapse un-masters a word | **High** — it happens to every user at day 31 | High — a reward that moves backwards destroys trust | Lifetime XP reads only lifetime-stable fields (`modes[]`, `totals`) and is floored at a high-water mark (Task 2). `rewards.test.ts` covers three cases explicitly: same input → same output, a 40-day roll-off snapshot pair → identical XP, and a drop in `totals.words_mastered` → no decrease. |
| Learn's virtualizer mis-measures the taller redesigned rows, making scroll jump | Medium | Medium | Keep `virtualizer.measureElement` on the row wrapper and raise `estimateSize` to the new collapsed height; Task 8 DoD includes scrolling to the end of the filtered list without position jumps. |
| 6-item bottom nav overflows or drops below the 44px target at 390px | Low | High — brief non-negotiable | `grid-cols-6` at 390px = 65px per item; Task 6 DoD measures the rendered nav item box and asserts no horizontal scroll at 390px. |
| Dark palette breaks AA where `text-white` sat on accent fills | High | High — brief non-negotiable | `--color-on-accent` token introduced in Task 1; Task 6 DoD greps `apps/web/src` for `text-white` and confirms zero remaining on accent surfaces. |
| Celebration sheets block the next question | Medium | Medium | Large tier is rate-limited to one per session and renders non-blocking over the session-end summary (Task 5); no sheet is mounted mid-run. |

## Goal Verification

### Truths

1. Every one of the six screens renders at 390 px in **both** light and dark with no horizontal scroll and no AA contrast failure on body text — a property no single screen scenario checks.
2. With `prefers-reduced-motion: reduce` active the app is fully usable and every state change is still communicated by final position, icon or words — no feedback disappears with the animation.
3. No number shown anywhere in the reward layer is client-invented: each is traceable to a `GET /api/stats` field, a per-run value, or the explicitly-labelled device-local best score.

## E2E Test Scenarios

### TS-001: Theme switch survives every screen and a reload
**Priority:** Critical
**Preconditions:** App loaded at 390×844 on `:3000`
**Mapped Tasks:** Task 1, Task 6

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tap the theme toggle in the header | Page repaints dark; `<html>` carries `class="dark"` |
| 2 | Navigate through all six nav destinations | Every screen is dark; no white flash between routes |
| 3 | Reload the page | Still dark, with no light-mode flash on first paint |
| 4 | Read computed colour of body text on `--color-paper` | Contrast ≥ 4.5:1 |

### TS-002: Home reads as a reward hub
**Priority:** Critical
**Preconditions:** Seeded user with history
**Mapped Tasks:** Task 7, Task 2, Task 3

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/` | Daily-goal ring shows `reviews today / goal` with the streak count and a flame inside it |
| 2 | Read the XP strip | Level chip, progress bar, and "N XP to L{next}" — the numbers agree with `GET /api/stats` |
| 3 | Read the four mode cards | Each shows a live stat; exactly one carries the "Suggested" pill |
| 4 | Read the achievements row | Earned badges plus the next locked one with its literal unlock condition |
| 5 | Tap a mode card | Routes to that mode |

### TS-003: Home zero state invents nothing
**Priority:** High
**Preconditions:** `localStorage.removeItem('vocab.user_id')`, then reload
**Mapped Tasks:** Task 7, Task 4

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Load `/` as a brand-new user | No fabricated streak/XP; a first-session CTA is the primary action |
| 2 | Read the mode cards | Learn is enabled with "Start here"; the gated modes state their condition (e.g. "After 10 words") |

### TS-004: Learn reveal, rate, and session rhythm
**Priority:** Critical
**Preconditions:** Seeded user, `/learn`
**Mapped Tasks:** Task 8, Task 3

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Type a query in the search field | List filters instantly; the count updates |
| 2 | Tap a POS filter chip then a status chip | Both chips read active; list narrows |
| 3 | Tap a row | Row expands with a reveal transition; definitions and the rating bar appear |
| 4 | Tap "Good" | Row collapses, status badge updates, next-review interval is shown, and a `+N XP` chip floats |
| 5 | Rate until the session counter hits 10 | A small celebration fires once at 10 |
| 6 | Scroll to the end of the filtered list | No scroll jump or blank rows |

### TS-005: Quiz feedback and results reward moment
**Priority:** Critical
**Preconditions:** Seeded user, `/quiz`
**Mapped Tasks:** Task 9, Task 5

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Pick "Word → Definition" | Question 1/10 with a segmented progress bar |
| 2 | Choose the correct option | Options lock; chosen option shows icon + "Correct" + colour; a combo chip appears |
| 3 | Choose a wrong option on the next question | Chosen shows icon + "Not quite"; the correct option is also revealed; combo resets |
| 4 | Finish the session | Results show score, accuracy ring, XP earned, streak line, and missed words linking to `/learn?word=` |
| 5 | Tap a missed word | Lands on `/learn` scrolled to that word, expanded |

### TS-006: Matching board — tap, drag, and finish
**Priority:** High
**Preconditions:** Seeded user, `/matching`
**Mapped Tasks:** Task 10

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tap a word tile | Tile reads selected; definition tiles become valid targets |
| 2 | Tap the matching definition | Both lock with ✓ + text label and a settle animation; pairs-left indicator decrements |
| 3 | Tap a word then a wrong definition | Shake + ✗ + text; neither tile locks |
| 4 | Drag a word tile onto its definition | Same lock result as the tap path |
| 5 | Clear the board | Finished card shows accuracy, moves, time, XP earned, and "Play again" |

### TS-007: Word Rush HUD, multiplier, and game over
**Priority:** High
**Preconditions:** Seeded user, `/game`
**Mapped Tasks:** Task 11

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tap Start | HUD shows a 90s timer, score 0, streak 0, ×1 badge |
| 2 | Tap "Match"/"No match" to build a 5-streak | Multiplier badge steps to ×2 with a distinct celebration |
| 3 | Drag a card past the commit threshold | Card rotates with the drag; the intent zone label ("Match"/"No match") is visible before release |
| 4 | Let the clock reach ≤10s | Timer escalates visibly (not by colour alone) |
| 5 | Let the run end | Game Over shows score, best streak, accuracy, XP earned, best-score comparison, missed pairs, and replay |

### TS-008: Progress trophy case
**Priority:** High
**Preconditions:** Seeded user, `/stats`
**Mapped Tasks:** Task 12

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/stats` | Hero shows mastered/1,000 with the 100/250/500/1,000 milestone track |
| 2 | Read the 30-day strip | 30 columns, current streak visibly marked, no horizontal scroll |
| 3 | Read per-mode accuracy | Each bar carries its number as text, not colour alone |
| 4 | Read the badge grid | Earned and locked are visually distinct; every locked badge states its exact condition and progress |
| 5 | Tap a hardest word | Routes into `/learn?word=` for that word |

### TS-009: Offline write is visible and never lost
**Priority:** Medium
**Preconditions:** `/learn` open, DevTools network offline
**Mapped Tasks:** Task 4

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Go offline, rate a word | Row updates optimistically; an offline banner shows the queued count; a "Queued" chip appears on the row |
| 2 | Go back online | Queue flushes; chip flips to "Synced"; the banner clears |
| 3 | Reload and re-check that word | Server state matches the rating |

### TS-010: Reduced motion keeps every signal
**Priority:** Medium
**Preconditions:** Emulate `prefers-reduced-motion: reduce`
**Mapped Tasks:** Task 1, Task 3, Task 5

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Answer a quiz question correctly | Feedback chip is present at final state — no travel, no scale, same words |
| 2 | Finish a session that levels you up | Sheet is present fully formed; no sheen, no ring sweep; identical copy and dismiss |
| 3 | Load `/stats` | Rings and bars are drawn at final value; numbers render immediately |

## Progress Tracking

- [x] Task 1: Export the design canvas and install the Aurea token layer
- [x] Task 2: Reward engine — XP, levels, badges, daily goal, flame tiers
- [ ] Task 3: UI primitive set and motion utilities
- [x] Task 4: State set — skeletons, empty, error, and the offline write queue
- [ ] Task 5: Celebration layer — level-up sheet, badge unlock, XP float
- [x] Task 6: App shell — 6-item icon nav, header, dark-mode toggle
- [x] Task 7: Home as the reward hub
- [x] Task 8: Learn
- [x] Task 9: Quiz
- [x] Task 10: Matching
- [x] Task 11: Word Rush
- [x] Task 12: Progress, plus README sync

## Implementation Tasks

### Task 1: Export the design canvas and install the Aurea token layer

**Objective:** Pull all eight `.dc.html` mockups plus the `_ds` folder out of the Claude Design project into `docs/design/` so every later task can read its screen off disk, then replace the light-only token block in `apps/web/src/index.css` with the design's own `@theme` block, the `.dark` override, the shared keyframes, and the reduced-motion guard. Nothing renders differently yet beyond recoloured tokens — this is the floor the other eleven tasks stand on.

**Files:**

- Create: `docs/design/` (all files from project `b066b5fb-cb49-449a-89c9-616ffb211db2`, fetched with `DesignSync(method="get_file", …)` from the main conversation — subagents cannot reach this tool)
- Modify: `apps/web/src/index.css`
- Modify: `.gitignore`

**Key Decisions / Notes:**

- Paste the `@theme` block verbatim from `docs/design/SAT Vocab Visual System.dc.html` (search the file for `@theme block`): colours, `--font-sans`, the ten `--text-*` sizes with their `--line-height` partners, `--spacing: 0.25rem`, `--radius-sm|md|lg|xl|2xl`, `--shadow-e1|e2|e3`, `--ease-standard|spring|exit`, `--animate-tap|ui|enter|reward|celebrate`.
- Dark is a **class on `<html>`**, matching the design. Tailwind v4 needs the variant declared explicitly — `@custom-variant dark (&:where(.dark, .dark *));` — then the `.dark { --color-* }` overrides in `@layer base` (values in the same block of the same file, and cross-checked against `.theme-dark` in `SAT Vocab States.dc.html`).
- Add the two tokens the `@theme` block omits but the States mockup uses: `--color-shim` (`#f4f0ea` light / `#3b352e` dark) for the skeleton highlight, and `--color-on-accent` (`#ffffff` light / `#06231f` dark) for text on accent fills.
- Keyframes to define once here, shared by every screen: `shimmer`, `pop`, `rise`, `ringsweep`/`ringfill`, `sheen`, `flicker`, `spin`, and the design's 5-stop `shake` (±3px/±3px/±2px/±2px, replacing the current ±6px 2-iteration version).
- Keep `@media (prefers-reduced-motion: reduce)` collapsing `animation-duration`/`transition-duration` to `1ms` globally — it is the safety net, not the whole reduced-motion story; per-component fallbacks live in Tasks 3 and 6.
- Keep the existing `.tap`, `:focus-visible`, and `overflow-x: hidden` rules.
- Gitignore `docs/design/` next to the existing `docs/design-prompts.md` entry.

**Definition of Done:**

- [ ] `docs/design/` contains all 8 `.dc.html` files, `support.js`, and the 6 `_ds/aurea-…/` files; `git status --porcelain docs/design` prints nothing
- [ ] `apps/web/src/index.css` resolves `--color-xp`, `--color-flame`, `--color-gold`, `--color-shim`, `--color-on-accent`, `--radius-xl`, `--shadow-e2`, `--ease-spring` in both themes
- [ ] Adding `class="dark"` to `<html>` in the running app repaints every existing screen with the dark palette
- [ ] Verify: `bun run --filter @vocab/web build`

### Task 2: Reward engine — XP, levels, badges, daily goal, flame tiers

**Objective:** Add `lib/rewards.ts`, a pure module that turns a `StatsDto` (plus optional per-run values) into every reward number the UI shows, and cover it with the plan's one unit test. No React, no I/O, no accumulators — the same input must always produce the same output so XP can never drift.

**Files:**

- Create: `apps/web/src/lib/rewards.ts`
- Create: `apps/web/src/lib/rewards.test.ts`
- Create: `apps/web/vitest.config.ts`
- Modify: `apps/web/package.json`

**Key Decisions / Notes:**

- Every constant comes from the `<script type="text/x-dc">` block at the end of `docs/design/SAT Vocab Reward System.dc.html` — read it before writing code. Thresholds `LV = [0, 500, 1500, 3500, 7500, 15500, 27500, 44000, 65000, 92000, 126000, 168000]`; titles `Novice, Reader, Collector, Lexicon, Wordsmith, Rhetorician, Orator, Philologist, Etymologist, Polymath, Sesquipedalian, Verbatim`.
- **`lifetimeXp(stats)` — the level driver — reads only lifetime-stable fields** (see Assumptions; sourcing any of these from `mastery_over_time` makes XP fall as days roll out of the 30-day window):
  - `10 × modes[mode='learn'].attempts` — words rated in Learn
  - `5 × Σ modes[].correct` — correct answers across every mode
  - `25 × totals.words_mastered` — words mastered
- **`sessionXp(delta)` — a separate, non-accumulating figure** for session-end screens, using the design's per-event values: `+10` rated, `+5` correct, `+25` mastered, `+30` daily goal met, `+50` on a seventh streak day, Word Rush `score ÷ 4`. It is displayed ("+340 XP this session"), never added to the lifetime total.
- A word can be *un-mastered* by a lapse (README, SM-2 section), so `totals.words_mastered` can dip. Floor `lifetimeXp` at a `localStorage` high-water mark so the displayed total and level never move backwards — the one place a client-side value is allowed, because it only ever prevents a decrease.
- All 13 badges with their literal conditions, five families (breadth 3, depth 3, consistency 4, precision 2, speed 1). Each badge exposes `{ id, name, family, condition (the literal string shown in the UI), earned, progress: {current, target} }` so the locked treatment can render "100/500" without a second source of truth.
- Daily goal: `clamp(median(reviews over the last 14 days with reviews > 0), 8, 20)`, default 10 with no history; never auto-raises above the persisted value, may lower (see Autonomous Decisions).
- Flame tier is a pure `streak → 'none'|'day3'|'day7'|'day30'|'day100'|'atRisk'` mapping; `atRisk` when today has zero reviews and the streak is ≥ 1.
- Grace-day predicate returns a boolean for the nudge copy only — it never alters the streak number.
- Also export `ringDash(pct, radius)` here — the `{ dasharray, dashoffset }` pair the Task 3 `ProgressRing` needs. Keeping the arc arithmetic in the tested pure module is what lets Task 3 ship without a component test.
- `vitest.config.ts` mirrors `packages/db/vitest.config.ts` (no DB, so no `fileParallelism` clamp needed); add `"test": "vitest run"` and `vitest` to `devDependencies` — `turbo run test` then picks `@vocab/web` up automatically.
- Test the behaviour, not the shape: fixed `StatsDto` fixtures with hand-computed expected XP and level (derived from the design table, not from the implementation), each badge's boundary at threshold−1 / threshold, goal clamping at both ends, and the determinism + no-regression invariants named in the Risks table. One test file, no component tests.

**Definition of Done:**

- [ ] A `StatsDto` fixture with `modes[learn].attempts = 1284` and `totals.words_mastered = 78` yields the XP and level the design's own curve gives for those inputs
- [ ] **Roll-off case:** two snapshots of the same underlying history taken 40 days apart — identical `totals`/`modes`, but the older active days aged out of `mastery_over_time` — return the same `lifetimeXp` and the same level
- [ ] **Un-master case:** a snapshot whose `totals.words_mastered` dropped by 3 still reports a `lifetimeXp` no lower than the previous high-water mark
- [ ] Each of the 13 badges flips `earned` exactly at its stated threshold, and every locked badge reports a `progress` pair
- [ ] `dailyGoal` returns 10 with no history, clamps to 8 below the floor and 20 above the ceiling, and does not exceed a previously persisted goal
- [ ] `ringDash(0.5, 41)` returns a `dashoffset` equal to half its `dasharray`
- [ ] Calling the top-level derive function twice with the same input returns deeply equal results
- [ ] Verify: `bun run --filter @vocab/web test`

### Task 3: UI primitive set and motion utilities

**Objective:** Build the component vocabulary the mockups reuse on every screen — card, three button variants, chip, pill badge, progress bar, progress ring, streak flame, XP counter, skeleton, count-up numeral, and the shared inline-SVG icon set — each matching the `1c Component specs @ 390px` block and each with its reduced-motion behaviour built in rather than bolted on.

**Files:**

- Create: `apps/web/src/components/ui/` (`Icon.tsx`, `Button.tsx`, `Card.tsx`, `Chip.tsx`, `Progress.tsx`, `Flame.tsx`, `XpCounter.tsx`, `Skeleton.tsx`, `CountUp.tsx`)
- Create: `apps/web/src/lib/motion.ts`

**Key Decisions / Notes:**

- Read `docs/design/SAT Vocab Visual System.dc.html` variant `1c` for exact geometry. Card `rounded-xl` (22px) + `shadow-e1` + `border-line` + `p-4`. Primary button `h-12 rounded-[14px] bg-accent text-on-accent font-semibold`, `active:scale-97` + `bg-accent-strong`, `transition` 90ms/160ms. Secondary `border-[1.5px] border-accent bg-transparent text-accent-strong`. Ghost `h-11 text-muted`, hover tint.
- Chip `h-8 px-3 rounded-full text-[12.5px] font-semibold` with flame / accent / outline variants. Pill badge `h-5 px-2 rounded-full text-[10px] font-bold uppercase tracking-[.04em]` with `Suggested` / `New badge` / `At risk` variants.
- `ProgressRing` takes `size`, `stroke`, `pct` and gets its arc geometry from `ringDash()` in `lib/rewards.ts` (Task 2) rather than recomputing it — `dasharray = 2πr`, `dashoffset = dasharray × (1 − pct)`, `transform="rotate(-90 c c)"`; the design's 96px ring is `r=41, stroke=9, dasharray≈258`. One component serves the 96px component ring, the 170px level-up ring, and the Progress hero ring; do not hard-code three.
- `Flame` renders the design's single flame path with the five tier treatments plus the dashed at-risk variant; the 2.4s `flicker` loop only from tier `day7` up.
- `CountUp` animates over 420ms with `--ease-standard` and **renders the final value immediately** under reduced motion; digits always `tabular-nums` so nothing shifts.
- `lib/motion.ts` exports one `usePrefersReducedMotion()` hook (a `matchMedia` subscription) — components branch on it for the cases the global 1ms override cannot express (skip a count-up, hold a chip 600ms instead of floating it).
- `Icon.tsx` holds the SVG `d` strings lifted from the mockups (nav home/study/words/stats/you, mode learn/quiz/match/rush, check, cross, flame, star, lock, offline, sync) as a typed record — one file, no icon font, no dependency.
- This task exceeds the usual 2–4 files: it is one mechanical kind of change (component specs transcribed from a single canvas block) and splitting it would leave callers referencing components that do not exist yet.
- **Nothing mounts these primitives until Task 7**, so this task's checkable DoD is limited to what static analysis and the Task 2 test can prove. The rendered-appearance bullets below are deliberately deferred to the screens that first consume each primitive — do not add a dev-only playground route to close the gap.

**Definition of Done:**

- [ ] No hard-coded hex anywhere in `components/ui` — `grep -rnE "#[0-9a-fA-F]{3,8}\b" apps/web/src/components/ui` returns only SVG path data, never a colour
- [ ] `ProgressRing` derives its arc from `ringDash()` and declares no arithmetic of its own (covered by the Task 2 test)
- [ ] `grep -rn "text-white" apps/web/src/components/ui` returns nothing
- [ ] Every component that animates reads `usePrefersReducedMotion()` or relies only on CSS the global `1ms` override neutralises — `grep -rn "animation\|transition" apps/web/src/components/ui` has no survivor that ignores both
- [ ] Verify: `bun run --filter @vocab/web check-types && bun run --filter @vocab/web lint`
- [ ] Deferred, verified in later tasks: light/dark appearance and reduced-motion behaviour of every primitive are checked in TS-001 (Task 6 shell), TS-002 (Task 7 Home — ring, flame, chip, XP counter), TS-005 (Task 9 Quiz — accuracy ring, count-up) and TS-010 (reduced motion)

### Task 4: State set — skeletons, empty, error, and the offline write queue

**Objective:** Replace the three generic helpers in `components/States.tsx` with the design's full state set — per-screen skeletons that mirror real block geometry, four empty states with their exact copy and a real next action, three error states that name the cause, and the offline path where a queued write is optimistic on screen from the first frame and visibly syncs later.

**Files:**

- Modify: `apps/web/src/components/States.tsx`
- Create: `apps/web/src/lib/outbox.ts`
- Modify: `apps/web/src/lib/events.ts`
- Create: `apps/web/src/components/ui/Toast.tsx`

**Key Decisions / Notes:**

- Copy comes verbatim from the `empties`, `errors`, and `finishes` arrays in the trailing script block of `docs/design/SAT Vocab States.dc.html` — e.g. quiz-empty is "Quiz needs 10 known words" / "You have 6. Quiz builds its wrong answers from words you've already seen, so it needs a few more first." / CTA "Learn 4 more words". Do not paraphrase.
- Export one skeleton per screen shape (`HomeSkeleton`, `ListSkeleton`, `QuizSkeleton`, `BoardSkeleton`, `StatsSkeleton`) built from the `Skeleton` primitive. Skeletons **hold a 400 ms minimum** so fast responses do not flash — implement as a `useMinimumDuration(isLoading, 400)` helper inside `States.tsx`, not a per-screen `setTimeout`.
- `outbox.ts` is the whole offline story and stays small: a `localStorage` array of pending event bodies, flushed on `window 'online'` and on next successful write, exposing `{ enqueue, pending$, retryNow }`. Because `event_id` is already a client-generated idempotency key (see `lib/events.ts`), replaying the queue is safe by construction — that is why this needs no server change.
- `sendEvent` keeps its current signature and its 404 user-recreate path; on a network failure it enqueues and resolves optimistically instead of throwing, so the caller's UI never stalls. A server rejection that is *not* a network failure still surfaces — the design has a distinct "One rating didn't save" card for it.
- `Toast.tsx` is a single host with a 240 ms `rise` in and a 3.2 s hold (4 s and no travel under reduced motion), mounted once in the app shell in Task 6.
- The offline banner and the per-row Queued/Synced chips read from `outbox`; no chip may sit in the path of the next question.

**Definition of Done:**

- [x] A failed write is parked with its `event_id`, resolves optimistically instead of throwing, and drains on the next successful write - browser-verified against the real API: two events queued while `POST /api/events` was failing, then replayed, leaving `learn` attempts at exactly 1 and `abase` at `status: learning` with a real SM-2 due date. Counted once, not twice.
- [x] `EmptyState` / `ErrorState` / the five per-screen skeletons / `OfflineBanner` / `SyncChip` all exist and typecheck
- [x] Verify: `bun run --filter @vocab/web check-types && bun run --filter @vocab/web lint`
- [ ] Deferred, verified where the copy actually lives: the four empty states and three error states are rendered by their own screens (Tasks 8-12, TS-004/005/006/008); the `OfflineBanner` mounts in the shell (Task 6) and the `SyncChip` on Learn rows (Task 8), so TS-009 closes there; the 400 ms skeleton floor is first observable on Home (Task 7)

### Task 5: Celebration layer — level-up sheet, badge unlock, XP float

**Objective:** Add the three-tier celebration system so the reward layer has somewhere to land: a micro tier on every correct answer, a small tier at session end, and a large tier for level-ups and badge unlocks — rate-limited to one large sheet per session and never blocking the next interaction.

**Files:**

- Create: `apps/web/src/lib/celebrate.tsx`
- Create: `apps/web/src/components/reward/LevelUpSheet.tsx`
- Create: `apps/web/src/components/reward/BadgeSheet.tsx`
- Create: `apps/web/src/components/reward/XpFloat.tsx`

**Key Decisions / Notes:**

- Tier budget from the design: micro 240 ms (icon pops, `+N XP` chip floats 46px and fades, row tints), small 900 ms (accuracy ring sweeps, XP counts up, stat cards stagger at 60 ms), large 1.6 s (sheet rises 420 ms, gradient sheen crosses once, medal or level number pops, ring sweeps behind). Reduced-motion equivalents are in the same table in `docs/design/SAT Vocab Reward System.dc.html` variant `7d` — implement all three.
- `celebrate.tsx` is a context provider exposing `celebrate({tier, …})`. It owns the one-large-per-session rule: if a level-up and a badge unlock land together they **queue into a single sheet with two rows**, never two sheets back to back.
- The sheet shell is the `--celebrate` gradient as a 1.5px padded border around a `--color-card` panel, `rounded-[26px]`, bottom-anchored with 14px insets. Sheets render *over* the session-end summary and dismiss in one tap; they never gate input.
- Newly-earned badges are diffed against a `localStorage` set of already-seen badge ids. On the very first computation the set is seeded silently (see Autonomous Decisions).
- `XpFloat` is the micro tier's floating chip; it is `pointer-events-none` and `aria-hidden`, with the accessible announcement carried by the existing `role="status"` region on each screen.

**Definition of Done:**

- [ ] Crossing a level threshold shows the level-up sheet once, with the level number, title, XP total, and the bar to the next level
- [ ] Earning a badge mid-session shows the unlock sheet with the badge's literal condition and its next sibling in the family; a returning user with previously-earned badges sees no sheet on load
- [ ] A level-up and a badge unlock in the same session produce exactly one sheet containing both
- [ ] Under `prefers-reduced-motion: reduce` the sheet appears fully formed with no sheen or pop, and its copy and dismiss are identical
- [ ] Verify: `bun run --filter @vocab/web check-types && bun run --filter @vocab/web lint`

### Task 6: App shell — 6-item icon nav, header, dark-mode toggle

**Objective:** Rebuild `Layout.tsx` as the design's shell: a bottom nav of six icon+label items on `--color-card` with `shadow-e2` and a safe-area inset, a header carrying the level chip and the theme toggle, and a no-flash theme boot so a dark-mode reload never paints light first. This is the first task whose result is visible end to end, so it is also where Tasks 1–5 get their first browser check.

**Files:**

- Modify: `apps/web/src/components/Layout.tsx`
- Create: `apps/web/src/lib/theme.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/index.html`

**Key Decisions / Notes:**

- Six destinations, per the resolved design conflict: Home `/`, Learn `/learn`, Quiz `/quiz`, Match `/matching`, Rush `/game`, Progress `/stats`. `grid-cols-6` inside `max-w-md`; at 390px that is 65px per item, above the 44px minimum. Each item `min-h-12`, column flex, `gap-[3px]`, 22px stroke icon over a `text-[10.5px]` label, active in `--color-accent-strong` with `stroke-width` 2.4 vs 1.9.
- `theme.ts` resolves `localStorage('vocab.theme')` → `prefers-color-scheme` → light, toggles `document.documentElement.classList`, and subscribes to the media query so a system change follows when the user has no explicit preference.
- The no-flash boot is a tiny inline `<script>` in `index.html` `<head>` that sets the class before first paint — the one place a blocking inline script is the right answer. Also switch the static `<meta name="theme-color">` to a pair of `media="(prefers-color-scheme: …)"` tags.
- Mount the Task 4 `Toast` host and the Task 5 `CelebrationProvider` here, inside `UserProvider` so both can read the user id. Both already exist by this point — that is why this task follows Task 5.
- Header shows the level chip (`L{n} {title}`) from `lib/rewards.ts`; it is absent mid-run in Quiz and Word Rush per the design's surfacing table, so the shell accepts a `chrome="full" | "minimal"` signal rather than each screen hiding it by hand.

**Definition of Done:**

- [ ] All six destinations are reachable from the bottom bar and the active item is distinguishable by weight and colour, not colour alone
- [ ] At a 390px viewport the page does not scroll horizontally and each nav item's rendered box is ≥ 44px on both axes
- [ ] Reloading with dark active paints dark on the first frame (no light flash)
- [x] Reloading with dark active paints dark on the first frame (no light flash) - boot script confirmed in `<head>`, ahead of the app bundle, and React does not strip the class
- [ ] `grep -rn "text-white" apps/web/src` returns no occurrence sitting on an accent fill. **Eight remain**, all in files Tasks 8-12 rewrite (`routes/{learn,quiz,matching,game,stats}.tsx`, `components/{quiz/Results,game/GameOver}.tsx`). They are a live dark-mode contrast defect until then - white on `#2fd6bf` is 1.9:1 - so each rewrite must clear its own, and Task 12 re-runs this grep as the closing check. The ninth hit, in `LevelUpSheet.tsx`, is intentional and commented: it sits on the fixed celebrate gradient, not a theme token.
- [x] Verify: `bun run --filter @vocab/web build`

### Task 7: Home as the reward hub

**Objective:** Replace the four flat mode cards and two chips with the design's rewards dashboard — a daily-goal ring with the streak flame inside it, an XP/level strip, four visually distinct mode cards each showing a live stat with one marked Suggested, a compact achievements row, and the two alternate states (streak at risk, brand-new user).

**Files:**

- Modify: `apps/web/src/routes/home.tsx`
- Create: `apps/web/src/components/home/GoalRing.tsx`
- Create: `apps/web/src/components/home/ModeCard.tsx`
- Create: `apps/web/src/components/home/LevelStrip.tsx`
- Create: `apps/web/src/components/reward/StreakNudge.tsx`

**Key Decisions / Notes:**

- Layouts for all four variants are in `docs/design/SAT Vocab Visual System.dc.html`: `1d` default (day 7, mid-session), `1e` streak at risk, `1f` zero state, `1g` dark. The at-risk nudge's full anatomy and copy is in `docs/design/SAT Vocab Reward System.dc.html` variant `7e`, third panel.
- Every displayed number routes through `lib/rewards.ts` — the route computes nothing itself. Mode-card live stats come from `stats.modes` and `stats.totals` (e.g. "588 not seen yet" = `1000 − totals.words_seen`, "74% accuracy — your weakest" = the lowest-accuracy mode).
- "Suggested" is one deterministic rule, not a heuristic pile: **the lowest-accuracy mode among `quiz`, `matching`, `game` with ≥ 20 attempts; Learn when none qualifies.** `modes[]` does contain a `learn` row (see Assumptions), but its "accuracy" is the share of self-ratings ≥ Good — not correctness, and not comparable to the other three. Excluding it is deliberate; state the rule and this reason in a comment so it is auditable.
- Zero state gates modes exactly as the design does (Learn "Start here"; Quiz "After 10 words"; Matching "Rate 2 more in Learn") and shows no fabricated streak, XP, or level.
- The at-risk nudge appears at most once per day (`localStorage` date stamp), never after 9pm local, and "Not tonight" is a full-width option. No countdown, no loss framing — the design's explicit "Explicitly not doing" list is a requirement, not a suggestion.
- Home is the busiest query consumer; the derived reward object is computed once per `stats` payload with `useMemo`, not per card.

**Definition of Done:**

- [ ] The goal ring shows today's reviews over the derived goal with the streak count and the correct flame tier inside it
- [ ] The level strip shows level, title, progress bar, and "N XP to L{next}" consistent with `GET /api/stats`
- [ ] Exactly one mode card carries the Suggested pill, and each card shows a live stat traceable to a stats field
- [ ] With `vocab.user_id` cleared, Home shows the zero state with no fabricated numbers and Learn as the only ungated mode
- [ ] Forcing today's reviews to zero with a non-zero streak renders the at-risk nudge with both actions
- [ ] Verify: `bun run --filter @vocab/web build`

### Task 8: Learn

**Objective:** Rebuild the virtualized word list on the new system — status carried as icon + label, a tactile reveal instead of a plain toggle, a rating bar that shows the resulting next-review interval, a session counter that celebrates at 10/25/50, and filter chips that replace the two `<select>` controls.

**Files:**

- Modify: `apps/web/src/routes/learn.tsx`
- Modify: `apps/web/src/components/learn/WordRow.tsx`
- Modify: `apps/web/src/components/learn/RatingBar.tsx`
- Create: `apps/web/src/components/learn/FilterChips.tsx`

**Key Decisions / Notes:**

- Read `docs/design/SAT Vocab Learn.dc.html` (trailing script block first) for row anatomy, reveal treatment, and copy.
- The next-review interval on each rating button comes from the server's own SM-2 result: `sendEvent` already returns `EventResult.progress.due_at`, so render the interval **after** the write resolves rather than re-implementing the SM-2 curve client-side. Before the write, buttons show the label only.
- Keep the existing virtualizer wiring and `measureElement`; raise `estimateSize` to the redesigned collapsed row height. Keep the `?word=` deep link, the ↑/↓ keyboard navigation, and the 1–4 rating keys — the design explicitly requires desktop keyboard affordances to stay visible.
- Filter chips replace both `<select>` elements: POS (All/Verbs/Nouns/Adjectives/Adverbs) and status (Any/New/Learning/Mastered), horizontally scrollable **within their own container** so the page never scrolls sideways.
- Session counter lives in route state (reset on unmount); celebrations at 10/25/50 go through the Task 5 small tier.
- Status stays icon + label + colour (`○ New`, `◔ Learning`, `✓ Mastered`) — never colour alone.

**Definition of Done:**

- [ ] A row expands with the design's reveal transition and collapses on re-tap
- [ ] Rating a word writes, updates the status badge, and shows the server-returned next-review interval
- [ ] The session counter increments per rating and fires exactly one celebration at 10
- [ ] Filter chips filter correctly and the page does not scroll horizontally at 390px with the longest headword and definition
- [ ] Keyboard: ↑/↓ moves focus, 1–4 rates an open row, and focus rings are visible
- [ ] Verify: `bun run --filter @vocab/web build`

### Task 9: Quiz

**Objective:** Rebuild the quiz flow — a direction picker that reads as a choice, a question card with segmented progress and full-width options, locked feedback marking both the chosen and the correct answer with icon + text + colour, a combo indicator across consecutive correct answers, and a results screen that is a genuine reward moment.

**Files:**

- Modify: `apps/web/src/routes/quiz.tsx`
- Modify: `apps/web/src/components/quiz/QuizCard.tsx`
- Modify: `apps/web/src/components/quiz/Results.tsx`

**Key Decisions / Notes:**

- Read `docs/design/SAT Vocab Quiz.dc.html`. The correct/wrong chip anatomy is shared with the Visual System's `1b` feedback rule: correct fills solid with `--color-ok-soft` + 1px `--color-ok` border + `pop` 240 ms; wrong keeps a 2px outline — the shape cue is deliberate so the two are distinguishable without colour.
- Keep the existing state machine, `SESSION_SIZE = 10`, the accumulating `askedIds` exclusion, and the 900 ms / 1700 ms auto-advance timings — they are tuned and the design does not contradict them.
- Combo chip is `×N` after two consecutive correct answers, resetting on a miss; it is a HUD element per the design's surfacing table (Quiz is the one non-Rush screen that shows a combo).
- Results screen: score, accuracy ring (Task 3 `ProgressRing`, small tier sweep), XP earned via `CountUp`, streak kept/extended line, any badge unlocked (delegated to Task 5, not re-implemented here), then the missed-word list with "Study missed words" primary. A perfect 10/10 gets its own distinct treatment.
- Keep the `sr-only` `aria-live` announcement and give it the same words as the visible chip.

**Definition of Done:**

- [ ] Answering locks all options and marks chosen + correct with icon, text label, and colour
- [ ] Three consecutive correct answers show a combo chip that resets on the next miss
- [ ] The results screen shows score, accuracy ring, XP earned, and the missed list linking to `/learn?word=`
- [ ] A perfect run renders its distinct celebration and no missed-word list
- [ ] Verify: `bun run --filter @vocab/web build`

### Task 10: Matching

**Objective:** Rebuild the pairing board with the design's five tile states, a lock animation that reads as a settle, a visible pairs-left indicator and move counter, and a finished screen that reports accuracy, time, and XP.

**Files:**

- Modify: `apps/web/src/routes/matching.tsx`
- Modify: `apps/web/src/components/matching/MatchBoard.tsx`
- Create: `apps/web/src/components/matching/BoardResult.tsx`

**Key Decisions / Notes:**

- Read `docs/design/SAT Vocab Matching.dc.html` for tile geometry and the idle / selected / dragging / valid-target / matched / wrong treatments.
- Keep the existing dual-input machinery exactly as it is — `attemptPair()` shared by both paths, pointer events for mouse *and* touch, `setPointerCapture` in a `try`, `elementFromPoint` with `pointer-events: none` on the dragged tile. It works under touch and is the fiddliest code in the app; restyle it, do not rewrite it.
- Long definitions are the layout hazard at 390px: line-clamp to 3 lines with tap-to-expand, verified against the longest definition actually in the seeded data.
- A wrong pair shakes with the new 5-stop `shake` plus ✗ plus the text "Not a match" — never red alone.
- Add a move counter (a count of attempts, already tracked in `attempts.current`) and a board timer that feeds the score without a countdown, so nothing pressures a guess.
- `BoardResult` uses the shared finished-card shape from the States design: what you did, what it earned, what's next.

**Definition of Done:**

- [ ] All five tile states are visually distinct, and matched/wrong carry an icon and a text label
- [ ] Both the tap path and the drag path lock a correct pair; a wrong pair shakes and locks nothing
- [ ] The longest seeded definition renders at 390px with no horizontal scroll, clamped and expandable
- [ ] Clearing the board shows accuracy, moves, time, XP earned, and "Play again"
- [ ] Verify: `bun run --filter @vocab/web build`

### Task 11: Word Rush

**Objective:** Make the game the most playful surface in the app — labelled intent zones on the swipe card, a HUD whose timer escalates in the last ten seconds, multiplier level-ups that celebrate at ×2/×3/×4, and a Game Over screen with XP and a personal-best comparison.

**Files:**

- Modify: `apps/web/src/routes/game.tsx`
- Modify: `apps/web/src/components/game/RushCard.tsx`
- Create: `apps/web/src/components/game/RushHud.tsx`
- Modify: `apps/web/src/components/game/GameOver.tsx`

**Key Decisions / Notes:**

- Read `docs/design/SAT Vocab Word Rush.dc.html` — it carries the pre-game, mid-run ×3, last-10-seconds, and both Game Over variants.
- Keep the game logic untouched: `GAME_SECONDS = 90`, `DECK_SIZE = 60`, `multiplierFor = min(4, 1 + floor(streak/5))`, the absolute `endAt` deadline so judgments cannot extend the clock, and the exactly-once `game_finished` event. This task is presentation plus the HUD.
- Intent zones are labelled with **text + icon** ("No match" / "Match") and appear as the drag crosses a fraction of `COMMIT_PX`, so the commit threshold is legible before release. Keep `COMMIT_PX = 80` and the `rotate(dx/18)` follow.
- The last-10-seconds escalation must not be colour-only: pair the `--color-err` treatment with a pulsing ring and the seconds rendered larger, so the state survives a colour-blind reading and reduced motion (under reduced motion the size and colour change remain, the pulse does not).
- Multiplier level-up fires the Task 5 micro tier with a distinct badge treatment per step; it must not block a judgment.
- Personal best reads `localStorage('vocab.rush_best')`, is labelled "your best on this device", and is written after `game_finished` resolves. Add the `SHORTCUT:` comment naming the upgrade trigger (a `best_score` field on `StatsDto`).

**Definition of Done:**

- [ ] Dragging past the threshold shows the labelled intent zone before release; both buttons still mirror the gesture
- [ ] The HUD shows timer, score, streak, and multiplier, and a 5-streak steps the multiplier with its own celebration
- [ ] At ≤10s remaining the timer escalates by size and colour together, not colour alone
- [ ] Game Over shows score, best streak, accuracy, XP earned, the device-best comparison, missed pairs linking to `/learn?word=`, and replay
- [ ] A full 90-second run judges cards without the clock resetting and writes exactly one `game_finished` event
- [ ] Verify: `bun run --filter @vocab/web build`

### Task 12: Progress, plus README sync

**Objective:** Turn the stats report into a trophy case — a mastered/1,000 hero with its milestone track, a 30-day activity strip with the streak visible in it, per-mode accuracy bars carrying their numbers as text, an actionable hardest-words list, and the full badge grid with every locked condition stated — then bring the README in line with what shipped.

**Files:**

- Modify: `apps/web/src/routes/stats.tsx`
- Create: `apps/web/src/components/stats/MasteryHero.tsx`
- Modify: `apps/web/src/components/stats/MasteryChart.tsx`
- Create: `apps/web/src/components/reward/BadgeGrid.tsx`
- Modify: `README.md`

**Key Decisions / Notes:**

- Read `docs/design/SAT Vocab Progress.dc.html` for the hero, strip, and badge-grid layouts.
- Charts stay inline SVG with no library. `MasteryHero` reuses the Task 3 `ProgressRing` at hero size with the 100/250/500/1,000 milestone ticks on the track.
- Fix a real bug while rewriting `MasteryChart`: it back-fills the 30-day window from local `new Date()` while labelling the days UTC, which skews the strip by a day for users behind UTC. Build the window from a UTC date so the axis and the API agree. Overlay the current streak run on the strip in `--color-flame`.
- Mode accuracy bars keep their numeric label — value encoded by length **and** text.
- `BadgeGrid` renders all 13 from `lib/rewards.ts` with the design's earned (family-tinted fill, solid border, ink name) versus locked (paper fill, dashed border, muted glyph, condition + progress figure) treatments. Never a silhouette or a "?".
- README updates: the frontend section describing the design system and reward layer, the dark-mode note, the updated in-browser verification line, and the repo-layout entry for the new `components/ui` and `lib/rewards.ts`. The "Testing" paragraph gains the frontend unit test.

**Definition of Done:**

- [ ] The hero shows mastered/1,000 with all four milestone ticks and the level title beside it
- [ ] The 30-day strip renders 30 columns from a UTC-anchored window, marks the current streak, and does not scroll horizontally at 390px
- [ ] The badge grid shows all 13 badges; every locked one states its exact condition and a progress figure
- [ ] A hardest-word row routes into `/learn?word=` for that word
- [ ] README describes the design system, dark mode, and the reward layer, and no longer describes the superseded UI
- [ ] Closing check carried from Task 6: `grep -rn "text-white" apps/web/src` returns only the commented celebrate-gradient use in `LevelUpSheet.tsx`
- [ ] Verify: `bun run --filter @vocab/web build && bun run lint && bun run check-types`
