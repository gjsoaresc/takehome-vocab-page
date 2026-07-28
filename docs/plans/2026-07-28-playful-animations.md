# Playful Animations (Delight Ideas 9a–9g + Home 10a–10e) Implementation Plan

Created: 2026-07-28
Author: jacob@evren.gg
Agent: Claude Code
Status: VERIFIED
Approved: Yes
Iterations: 0
Worktree: No
Type: Feature

## Summary

**Goal:** Port all twelve playful motion ideas from the Claude Design doc `SAT Vocab Delight Ideas.dc.html` — the cross-screen delight map (9a–9g) plus the five Home deepeners added in turn 10 (10a–10e) — onto the real app's existing screens, using only data the API already returns.

## Out of Scope

- **9h ships as adherence, not code.** No motion is added to the bottom nav, to list scrolling, to the Learn search input, or to any element while a quiz question sits unanswered.
- **A per-mode-per-day API rollup.** `StatsDto` (`packages/shared/src/index.ts:97-109`) returns per-day *overall* reviews and per-mode *lifetime* totals — there is no per-mode time series. 10b's "last 7 sessions" sparkline and 10c's "accuracy climbs 4 points before 8pm" therefore **cannot be built honestly** and are not built. Task 6 substitutes the real figures the endpoint does return. Extending the API was offered and declined.
- **10a's "celebrate edge on level crossing."** The app already celebrates a level-up with a full sheet (`LevelUpSheet` via `useCelebrate`, `lib/celebrate.tsx:54`). Adding a second in-place celebration for the same event would double up, and `LevelStrip` has no "just crossed" signal in its props. Task 5 builds the approach node and the live counter only.
- **`MasteryChart`'s 30-day bars.** Already animate on mount via `animate-grow-bar` (`MasteryChart.tsx:84`), and the card sits above the fold on Progress — rewiring them to IntersectionObserver would change nothing a user sees.
- **Component-level tests for the animations.** The repo has vitest but no DOM testing library (`apps/web/package.json` lists no `@testing-library/*`, no `jsdom`/`happy-dom`; `vitest.config.ts` pins `environment: 'node'` and `include: ['src/**/*.test.ts']`). Pure helpers get unit tests in the existing `rewards.test.ts`; every animation is verified in the browser via TS-001…TS-008.

## Approach

**Chosen:** Extend the existing Aurea motion layer in place — new `@keyframes` and `--animate-*` tokens in `apps/web/src/index.css`, then per-surface changes inside the components that already own each screen (`GoalRing`, `LevelStrip`, `ModeCard`, `home.tsx`, `QuizCard`, `WordRow`, `RushCard`, `ModeAccuracy`, `MasteryHero`, `BadgeGrid`), with new pure helpers landing in the already-tested `lib/rewards.ts`.

**Why:** The app already owns this whole vocabulary — named motions in `@theme static` (`index.css:103-119`), `usePrefersReducedMotion` (`lib/motion.ts`), a 420ms `CountUp`, a live wall clock (`lib/clock.ts`), and ring geometry beside its tests in `lib/rewards.ts` — so every idea lands as a small diff in an existing file instead of a new animation subsystem. The cost is concentration: `GoalRing.tsx` absorbs three ideas (9a ticks, 9b poke, 10d week strip) and grows from 72 to roughly 200 lines. It stays one component because all three gestures share one 184px ring, and splitting them would mean three components fighting over the same layout box.

## Context for Implementer

**The daily goal is not the design's hard-coded 12.** It is derived per learner by `dailyGoal()` (`rewards.ts:157`) and clamped to **8–20** by `GOAL_FLOOR`/`GOAL_CEIL` (`rewards.ts:140-141`). Eight to twenty ticks around a 184px ring are all legible, so no arc fallback is needed — but nothing may assume 12, and `reviewsToday` can legitimately exceed `goal`, so every tick index must clamp.

**Home now carries six interactive surfaces** (9a, 9b, 10a, 10b+10c, 10d, 10e) against 9h's "one playful surface per screen". That over-budget is a deliberate, user-approved decision, not an oversight. It raises the bar on two things the tasks below enforce individually: no two gestures may share a hit area, and nothing may animate on Home without a user action or a scroll — there is no ambient idle motion anywhere except 10a's approach node, which is the single exception and only appears in the last stretch of a level.

**Reduced motion is handled in two layers, both already present:** the global `1ms` override (`index.css:444`) freezes everything, and `usePrefersReducedMotion()` is for what CSS cannot express. Tasks 3, 6, 9, 10 and 12 need the hook; the rest degrade correctly under the global override alone, and every task's DoD names what the user still sees when motion is off.

**Nested interactive content is the recurring trap in this plan.** Three surfaces hit it — 9b's flame inside 10d's ring, and 10c's badge button inside the suggested card's `<Link>`. `<a>` may not contain `<button>`, and nested tap targets fight. Tasks 3/4 and 6 each specify their resolution explicitly; do not improvise a third pattern.

## Runtime Environment

`.claude/launch.json` already defines both servers.

- **API:** `bun apps/api/src/index.ts` — port 3001. Needs Postgres: `docker compose up -d postgres` (port 5434; credentials in `.env.example`).
- **Web:** `bun run --filter @vocab/web dev` — port 3000, proxies `/api` to 3001.
- **Verify commands:** `bun run check-types`, `bun run lint`, `bun run test` (repo root, turbo-driven).

## Assumptions

- `RushCard` remounts on every new card because `game.tsx:298` passes `key={s.index}` — Task 10 relies on that remount to replay the letter cascade instead of adding its own key. Removing that `key` would silently stop 9e replaying.
- Every day in `stats.mastery_over_time` is keyed by a UTC date string (`MasteryChart.tsx:11-19` builds its window that way, and `deriveRewards` reads today's row with `utcToday()` at `rewards.ts:379-380`). Task 4's week strip keys off the same UTC arithmetic; if the API ever switched to local dates, the strip would shift by a day for anyone behind UTC.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Home's six gestures collide — a poke lands on the week toggle, a peek-hold fires a navigation | Medium | High | Tasks 3/4 split the ring's two gestures onto physically separate targets (flame inside, summary line beneath); Task 6 discriminates hold from tap by press duration and suppresses the click only when a peek actually opened. TS-001 and TS-003 exercise both boundaries. |
| 10e's night palette fails contrast, or breaks in the app's dark theme | Medium | High | Palettes are defined as `--tod-*` tokens in `@theme static` with `.dark` overrides, following the existing token pattern (`index.css:124-158`) — not as the design's hard-coded hexes. Task 7's DoD requires a measured ≥4.5:1 for body text and ≥3:1 for the large greeting on all three palettes in both themes. |
| The flipped face of 10c stays keyboard-reachable while invisible | Medium | Medium | Task 6 requires the hidden face to be removed from the tab order and the accessibility tree whenever it is turned away. |
| Goal-met ripple re-fires on unrelated re-renders | Medium | Low | Task 2 latches the ripple to the `done < goal → done >= goal` transition via a previous-value ref, not to the truthiness of `goalMet`. |

## Goal Verification

### Truths

1. With `prefers-reduced-motion: reduce` active, every one of the twelve surfaces still communicates the same state it did before the change — nothing becomes invisible, stuck at zero, unreachable, or unreadable because an animation was neutralised.
2. No two interactive surfaces on Home share a hit area: each of the poke, the week toggle, the mode-card peek, the "Why this?" flip and every mode-card navigation can be triggered without triggering another.
3. Nothing in the app animates without either a user action or a scroll-into-view, with exactly one deliberate exception — 10a's approach node in the last stretch of a level.

## E2E Test Scenarios

### TS-001: Home — ring ticks, flame poke, and the week strip
**Priority:** Critical
**Preconditions:** Seeded user with a non-zero streak and ≥1 review today (Home renders past `ZeroState`).
**Mapped Tasks:** Task 2, Task 3, Task 4

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `http://localhost:3000/` | Goal ring renders as discrete ticks, not a continuous arc; filled ticks equal today's reviews, total ticks equal the daily goal |
| 2 | Read the ring's accessible name via `read_page` | Announces "N of GOAL reviews done today" |
| 3 | Confirm the ring centre and its outer size | Flame, streak number and "day streak" label still centred inside a 184px ring, laid out as before |
| 4 | Click the flame | Flame wiggles and settles; no navigation, and the week strip does **not** open |
| 5 | Click the flame twice more within 1.5s of the first click | A flare ring bursts around the flame and its backing tint changes |
| 6 | Click the summary line beneath the ring ("N of GOAL reviews today") | A 7-day dot strip unfolds beneath it, dots dealing in staggered; the line's `aria-expanded` reads `true` |
| 7 | Confirm the strip's contents | Seven dots oldest→today, each labelled with its weekday |
| 7b | Seed a mixed week — some days at/over goal, some with 0 < reviews < goal, some with none — and reload | All three states render distinguishably **without relying on colour**: met carries the flame glyph, partial a dashed outline, open a plain empty outline |
| 8 | Click the summary line again | The strip folds away and `aria-expanded` returns to `false` |

### TS-002: Home — XP bar grows an approach node
**Priority:** High
**Preconditions:** A user whose XP sits within 200 of the next level threshold.
**Mapped Tasks:** Task 5

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/` and locate the Level strip | A pulsing node sits at the end of the XP track |
| 2 | Read the "N XP to level M" counter | It rolls up to its value rather than appearing instantly |
| 3 | Seed a user well over 200 XP from the next level and reload | No node is rendered at all |
| 4 | Seed a top-level user (`xpToNext === null`) and reload | No node, no crash, and the strip reads "Top level reached" as before |

### TS-003: Home — mode cards peek and explain themselves
**Priority:** High
**Preconditions:** A user with recorded attempts in ≥2 graded modes, so a suggestion is computed.
**Mapped Tasks:** Task 6

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/` and press-and-hold one of the plain mode cards (not the suggested one) for ~1s | A panel unfolds inside the card showing that mode's real accuracy, its correct/attempts split and its rank |
| 2 | Release | The panel folds shut and the app does **not** navigate |
| 3 | Click the same card normally (quick tap) | The app navigates to that mode |
| 4 | Click the "Why this?" badge on the suggested card | The card flips to a reasoning face citing the real rule and figures; the app does not navigate |
| 5 | Tab through Home while the card is flipped | Focus never lands on a control belonging to the hidden face |
| 6 | Click "Flip back" | The card returns to its front face |

### TS-004: Home — the header knows what time it is
**Priority:** Medium
**Preconditions:** Ability to override the clock (emulate a fixed time per run).
**Mapped Tasks:** Task 7

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Load `/` with the clock at 07:10 | Header shows a morning palette, a morning greeting, and a goal-aware supporting line |
| 2 | Load `/` with the clock at 14:30 | Header cross-fades to the afternoon palette with its own greeting and line |
| 3 | Load `/` with the clock at 21:45 | Header shows the night palette; its greeting and body text remain legible against it |
| 4 | Measure contrast of the header's body text and greeting on all three palettes, in light and dark theme | Body ≥4.5:1, large greeting ≥3:1, in every combination |
| 5 | Confirm the weekday/time line and the goal state message | Both still present; exactly one greeting is shown, not two |

### TS-005: Quiz — combo heat thickens, then snuffs
**Priority:** Critical
**Preconditions:** Enough words seeded for a 10-question round.
**Mapped Tasks:** Task 8

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/quiz`, click "Word to definition" | Question card renders with no glow at combo 0 |
| 2 | Answer two questions correctly | The `x2` chip appears and the card gains a flame border plus a soft glow |
| 3 | Answer two more correctly | The glow visibly thickens at the x4 step |
| 4 | Answer the next question incorrectly | The card shakes once, the glow clears and the chip disappears |
| 5 | Confirm the chosen wrong option | Marked with its cross icon, "Your pick" tag and red fill, and it does **not** shake a second time |
| 6 | Watch an unanswered question for ~5s | Nothing on the card moves |

### TS-006: Learn — the reveal cover leans toward the pointer
**Priority:** High
**Preconditions:** Words list loaded.
**Mapped Tasks:** Task 9

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/learn`, click any word row | Row expands, showing the dashed "Reveal meaning" cover |
| 2 | Hover across the cover left to right | The cover tilts toward the pointer, at most ±7° |
| 3 | Move the pointer off the cover | Tilt returns to flat |
| 4 | Scroll the list with collapsed rows on screen | No collapsed row tilts, shifts or animates |
| 5 | Click the cover | Definition reveals; the rating bar becomes enabled |

### TS-007: Word Rush — letters deal in per card
**Priority:** High
**Preconditions:** ≥20 words seen so Word Rush is ungated.
**Mapped Tasks:** Task 10

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/game`, click "Start the 90" | The first headword's letters arrive staggered, not all at once |
| 2 | Click "Match" while letters are still arriving | The judgment registers immediately |
| 3 | Observe the next card | Its letters cascade again from the start |
| 4 | Read the headword's accessible name via `read_page` | Announced as one whole word, not letter by letter |

### TS-008: Progress — bars perform on entry, badges take a polish
**Priority:** High
**Preconditions:** A user with attempts in ≥2 modes and ≥1 earned badge.
**Mapped Tasks:** Task 11, Task 12

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/stats` | The "Mastered" headline rolls up to its final value |
| 2 | Scroll until "Accuracy by mode" enters the viewport | Its bars grow left-to-right, staggered ~90ms apart, settling at their true percentages |
| 3 | Scroll away and back | Bars stay at final width — the entry plays once per visit |
| 4 | Press and hold an earned badge | A sheen sweeps across it and it swells slightly |
| 5 | Release | It springs back; icon, tint and name unchanged |
| 6 | Tab through the badge case | No new tab stops were added by the polish effect |

## E2E Results

| Scenario | Priority | Result | Fix Attempts | Notes |
|----------|----------|--------|--------------|-------|
| TS-001 | Critical | PASS | 0 | 8 ticks / 4 filled, label correct, 184px ring, centre intact; wiggle → flare → tint; strip untouched by pokes; 7 days Wed→Tue with 1 met + 2 partial + 4 open, 40ms stagger; closes cleanly |
| TS-002 | High | PASS | 0 | Node present at 150 XP remaining, absent at 715, absent at top level with "Top level reached" intact; 18px, at track end, unclipped |
| TS-003 | High | PASS | 0 | Peek opens with real figures ("91% accuracy / 20 right of 22 answered / 1st of your 2 graded modes"); release does not navigate; tap navigates; flip rotates without navigating and swaps `inert` |
| TS-004 | Medium | PASS | 0 | All three palettes render with their own greeting and line; exactly one `<h1>`; weekday/clock line intact; contrast measured on all 3 palettes × 2 themes |
| TS-005 | Critical | PASS | 0 | No glow at combo 0–1; ×2 and ×4 tiers step visibly; wrong answer shakes the card once, clears the glow and the chip; the chosen option no longer shakes; zero animations mid-question |
| TS-006 | High | PASS | 0 | Tilt caps at ±7°; resets on pointerup / pointercancel / pointerout; collapsed rows never transform; `touch-action` untouched; click still reveals and enables the rating bar |
| TS-007 | High | PASS | 0 | Letters cascade at 18ms; announced as one word via sr-only; judging mid-cascade registers; next card replays; "antediluvian" (12 chars) correctly uses the 30px scale |
| TS-008 | High | PASS | 0 | Bars start at 0% off-screen and grow to true widths with 90ms stagger, once per visit; headline rolls 5→18→27→32→35→37; badge swells 73.5→77.9px with the sheen and springs back; zero new tab stops |

**Design Notes:** 1 advisory (`bounce-easing` at `RushCard.tsx:77`) — non-blocking, and out of lineage: that is the pre-existing swipe-release transition, and the easing is the design system's own `--ease-spring` token, used deliberately throughout Aurea. All other changed UI files scanned clean.

## Not Verified

| Not Verified | Reason |
|---|---|
| The ≥6 combo-heat tier (9c) | Verified at ×2 and ×4 live; only 5 questions remained in the round after building to ×4, so ×6 was unreachable in that session. Same three-branch expression as the verified tiers. |
| `useInView`, `goalRippleClaimed` / `markGoalRipple` unit tests | Need DOM / `localStorage`; `vitest.config.ts` pins `environment: 'node'` and the repo has no DOM testing library. Behaviour verified in-browser instead (bar entrance, once-per-day ripple latch). |
| Real touch-device gestures | All pointer interactions were driven with synthetic `PointerEvent`s and Playwright dispatch, not a physical touchscreen. `pointercancel` paths were exercised explicitly. |
| Pre-existing repo formatting drift (11 files this change never touched) | `bun run format:check` fails on files outside this change's lineage — pre-existing, left alone per the lineage rule. Every file this change touches passes. |

**Live-target probe:** Tier 1 succeeded — dev server already running on `localhost:62214` (HTTP 200). Tiers 2–4 not needed. Code identity confirmed: the served source carries `ringTicks`, `weekStrip`, `tickPop`, `pulseEnd`, `dotIn`, `tod-night-bg`.

## Verification Fixes

Three findings from the changes review, all applied and re-verified:

1. **Poking a day7+ flame permanently killed its ambient flicker** (real bug, full-motion). `Flame` merges its own `animate-flicker` with any passed `className`, so `animate-wiggle` landed on the same element; both set the `animation` shorthand and `--animate-wiggle` is declared later (`index.css:140` vs `:110`), so it won outright — confirmed in the built CSS at bytes 16866 vs 15894. The wiggle now rides a wrapper `<span>` so the two animations compose instead of contesting. Verified on a 9-day streak: flicker stays `running` through repeated pokes.
2. **Reduced-motion tab-order inconsistency.** `front`'s controls took `tabIndex={-1}` whenever `flipped`, but in the reduced-motion branch the front face stays visible — leaving a control that was on screen and mouse-clickable yet unreachable by keyboard. Suppression is now scoped to the 3D branch, where the face is genuinely turned away.
3. **Non-breaking space made explicit.** The reviewer read `RushCard`'s space branch as a no-op; the bytes were in fact `\302\240` (a literal U+00A0), so behaviour was already correct. Rewritten as the `' '` escape so it cannot be misread again.

Not actioned: the reviewer's note about Prettier reflow in `README.md` / `rewards.ts`. Those files carried pre-existing formatting drift, `bun run format:check` is a project script, and reverting the reflow would put this change's own files back into format-check failure.

## Progress Tracking

- [x] Task 1: Motion primitives — keyframes, named animations, reduced-motion delay reset
- [x] Task 2: 9a — daily goal ring becomes discrete ticks
- [x] Task 3: 9b — the streak flame becomes pokeable
- [x] Task 4: 10d — the ring opens into the week
- [x] Task 5: 10a — XP bar grows an approach node
- [x] Task 6: 10b + 10c — mode cards become browsable and explain themselves
- [x] Task 7: 10e — the header knows what time it is
- [x] Task 8: 9c — quiz question card gains combo heat
- [x] Task 9: 9d — Learn's reveal cover leans toward the pointer
- [x] Task 10: 9e — Word Rush headword letters deal in
- [x] Task 11: 9f — Progress bars perform on entry and the headline rolls up
- [x] Task 12: 9g — earned badges take a polish while held

## Implementation Tasks

### Task 1: Motion primitives

**Objective:** Add the five new keyframes and the named-motion tokens that 9a, 9b, 9e, 9g, 10a and 10d need, and close the one reduced-motion gap the existing global override leaves open — it neutralises `animation-duration` and `transition-duration` but not their delays, so a staggered element would sit invisible for its full delay before snapping in. Everything here is consumed by later tasks; on its own it must change nothing a user sees today.

**Files:**

- Modify: `apps/web/src/index.css`

**Key Decisions / Notes:**

- Follow the file's existing convention exactly: camelCase keyframe names, kebab-case `--animate-*` tokens inside `@theme static` (`index.css:103-119`), keyframe bodies appended to the shared block starting at `index.css:286`.
- New keyframes: `tickPop` (scale .3 → 1.5 → 1 with opacity — punchier than the existing `pop`), `wiggle` (scale + rotate, distinct from the ambient `flicker`), `lettersIn` (translateY 14px + rotate 6° → rest), `pulseEnd` (opacity .35 → 1 with a 1.35 scale, looping), `dotIn` (scale .3 + translateY 6px → rest).
- New tokens: `--animate-tick-pop: tickPop 300ms var(--ease-spring)`, `--animate-wiggle: wiggle 450ms var(--ease-spring)`, `--animate-letters-in: lettersIn 260ms var(--ease-spring) both`, `--animate-sheen-hold: sheen 1.1s linear infinite`, `--animate-pulse-end: pulseEnd 1.1s ease-in-out infinite`, `--animate-dot-in: dotIn 240ms var(--ease-spring) both`.
- `--animate-sheen-hold` deliberately **reuses the existing `sheen` keyframe** (`index.css:399`) rather than adding a near-duplicate; only duration and iteration count differ from `--animate-sheen`.
- No new `burst` variant: 9a's ripple and 9b's flare reuse `--animate-burst`, whose keyframe bakes in `translate(-50%, -50%)` (`index.css:384`). Both consumers therefore position their ring at `left-1/2 top-1/2` with an explicit size rather than with `inset`. The existing consumer at `game.tsx:318` already does exactly this, so the convention is established, not invented here.
- Add `animation-delay: 0ms !important` and `transition-delay: 0ms !important` to the `prefers-reduced-motion` block at `index.css:444`. `grep -rn "animation-delay\|animationDelay" apps/web/src/` returns nothing today, so no existing motion depends on a delay surviving.

**Definition of Done:**

- [ ] `index.css` defines the five new keyframes and the six new `--animate-*` tokens, matching the file's existing naming convention
- [ ] The `prefers-reduced-motion` block zeroes both `animation-delay` and `transition-delay`
- [ ] With reduced motion off, Home / Quiz / Progress render exactly as before this task
- [ ] Verify: `bun run check-types && bun run lint`

---

### Task 2: 9a — daily goal ring becomes discrete ticks

**Objective:** Replace Home's continuous progress arc with one discrete tick per required review, so each logged review is a visible physical addition rather than a smoothly creeping arc. The newest filled tick pops as it lands, and completing the goal fires a one-time gold ripple. The ring centre is unchanged — flame, streak number and label stay exactly where they are.

**Files:**

- Modify: `apps/web/src/lib/rewards.ts`
- Modify: `apps/web/src/lib/rewards.test.ts`
- Modify: `apps/web/src/lib/reward-store.ts` (added during implementation — see the ripple-latch deviation below)
- Modify: `apps/web/src/components/home/GoalRing.tsx`

**Key Decisions / Notes:**

- Add `ringTicks(count, innerR, outerR, centre)` to `lib/rewards.ts` beside `ringDash` (`rewards.ts:335`) — pure geometry returning `{x1,y1,x2,y2}` per tick, starting at 12 o'clock and running clockwise. It lives there because that file already owns this codebase's ring arithmetic *and* is the only file in `apps/web` with an existing test suite.
- Extend the existing `rewards.test.ts` describe blocks — do **not** add a new test file. Assert: tick count equals `count`; the first tick sits at top-centre; every endpoint lies on its radius.
- **`GoalRing`'s non-fresh branch stops rendering `<ProgressRing>` entirely** and builds its own SVG, because `ProgressRing` draws a single dash-array arc (`Progress.tsx:104-118`) and cannot express ticks. That means `GoalRing` must now reimplement the three things `ProgressRing` was providing for it: the `relative` 184×184 sizing wrapper, `role="img"` + `aria-label` on its own `<svg>`, and the `absolute inset-0 flex flex-col items-center justify-center` div that centres the flame, streak number and label (`Progress.tsx:95`, `:120-122`). Ticks themselves are `aria-hidden`.
- `ProgressRing` keeps its four other callers untouched (`learn.tsx:245`, `Results.tsx:67`, `LevelUpSheet.tsx:46`, `BoardResult.tsx:50`); no shared `TickRing` primitive is introduced for a single consumer.
- Tick colour: `var(--color-line)` unfilled, `var(--color-accent)` filled, `var(--color-gold)` filled once the goal is met. `strokeLinecap="round"`, `transform-origin` at the ring centre.
- The newest filled tick (index `filled - 1`) carries `animate-tick-pop`.
  **Deviation (implemented):** no `key` remount is needed. The popping index moves with every review, so React drops the class from one `<line>` and adds it to another — and adding an animation class to an element that lacked it starts the animation. Verified in the browser: moving the class reports `tickPop` in `running` state on the new tick and zero animations left on the old one.
- **Clamp both ends:** `filled = Math.min(done, goal)`. `reviewsToday` can exceed `goal`, and an unclamped index would address a tick that does not exist.
- `goal === 0` must render zero ticks and not divide — mirror the existing guard at `GoalRing.tsx:53`.
- **Latch the ripple so it fires once a day, not once per crossing.**
  **Deviation (implemented):** the plan originally called for a previous-`done` ref firing on the `< goal → >= goal` transition. Building it exposed the flaw — the review that meets the goal is rated in Learn, answered in Quiz or judged in Word Rush, so **Home is almost never mounted at the moment the count crosses**, and a transition latch would mean the ripple essentially never plays. It is instead claimed against a UTC day stamp in `reward-store.ts` (`goalRippleClaimed` / `markGoalRipple`), matching how Home already gates its once-a-day streak nudge. Read and write are split so the decision is a pure read in a `useState` initialiser and the write happens in an effect — a sync `setState` inside an effect trips the repo's `react-hooks` lint rule. `burst` ends on `forwards` at opacity 0, so the element stays mounted and needs no timer or cleanup.
- The ripple is an absolutely positioned circle at `left-1/2 top-1/2` with an explicit size, carrying `animate-burst`.
- The `fresh` zero-state branch (`GoalRing.tsx:24-49`) is untouched.
- Reduced motion: the global override drops the pop and ends the `forwards` ripple invisible. No fallback code needed — Home already states the same fact in prose ("Goal met today" heading, "Day N is locked in" beneath the ring).

**Definition of Done:**

- [ ] Home's ring renders `goal` ticks with `min(done, goal)` filled; at `done > goal` nothing overflows or crashes
- [ ] The most recently filled tick plays `tick-pop`, replaying when the filled count increases again
- [ ] Reaching the goal tints filled ticks gold and fires the ripple exactly once — it does not refire on a re-render while the goal stays met
- [ ] The ring's outer size stays 184px and the centred flame / streak / label layout matches the pre-change render
- [ ] The ring's accessible name is still "N of GOAL reviews done today"
- [ ] `goal === 0` renders no ticks and throws nothing
- [ ] Verify: `bun run test && bun run check-types && bun run lint`

---

### Task 3: 9b — the streak flame becomes pokeable

**Objective:** Turn the streak flame at the centre of the goal ring into something you can poke: it wiggles on each tap, and three taps inside 1.5 seconds earn a flare ring and a warmer backing. Zero function, pure affection — the streak stops being a number and starts being a pet.

**Files:**

- Modify: `apps/web/src/components/home/GoalRing.tsx`

**Key Decisions / Notes:**

- Wrap the centre `<Flame>` (`GoalRing.tsx:59`) in a `<button type="button" aria-label="Poke the streak flame">`. `Flame.tsx` is untouched — it stays a pure presentational SVG, still shared with `StreakNudge.tsx:37` and with `GoalRing`'s own zero-state branch, neither of which becomes pokeable.
- **Tap target without layout shift:** keep the button's visual box at the flame's existing 40px and expand the hit area with a pseudo-element (`relative` + `after:absolute after:-inset-1`), clearing 44px. Do **not** use the `.tap` utility here — it sets literal `min-height`/`min-width: 44px` (`index.css:262-265`), which inside the ring's centred flex column would push the streak number and label down by 4px.
- **Fixed window, not sliding:** the 1.5s timer starts on the *first* poke of a run and is not re-armed by pokes 2 and 3, so "three pokes inside 1.5s" means what it says. The timer is cleared and the count reset when it expires or when the flare fires.
- **The poke count lives in a ref, not state** (implementation detail found while building): nothing renders from it, and reading it from state hands successive pokes landing in one tick the same stale value — three fast taps would each count as the first. A ref increments immediately and is batching-proof.
- **The warm backing tint is required, not decorative.** It is 9b's entire reduced-motion state: with motion off both the wiggle and the flare ring collapse to nothing, so the tint is all that remains to answer the poke. Without it this surface would have no non-motion fallback at all.
- The timer lives in a ref and **must be cleared on unmount** — Home unmounts on every route change, and a pending `setState` afterwards is exactly what this ref prevents.
- Replay the wiggle with `key={pokeKey}` on the `<Flame>` — React's remount is the idiomatic equivalent of the design's `animation-delay` restart hack.
- Flare ring reuses `--animate-burst` positioned at `left-1/2 top-1/2` with an explicit size (Task 1 note).
- **The flare repeats.** The design's prose says "once per visit" but its own reference implementation (`poke` in `renderVals`) resets and allows repeats; we follow the implementation. Called out at approval rather than buried here.
- No instructional copy in the UI — discovering it by accident is the point, and the ring centre has no room.
- Reduced motion needs no hook: the global override collapses the wiggle to imperceptible, and the flare's background tint is a plain style change that survives — which is the design's stated fallback ("the flame brightens one step instead of wiggling").

**Definition of Done:**

- [ ] Clicking the flame plays a wiggle that replays on every subsequent click
- [ ] Three clicks within 1.5s of the first fire a flare ring and change the backing tint; a click after the window expires starts a fresh count
- [ ] The streak number and label do not shift position when the flame becomes a button, and the hit area clears 44px
- [ ] Navigating away from Home mid-window leaves no live timer and logs no unmounted-setState warning
- [ ] Poking the flame never opens the week strip (Task 4)
- [ ] Verify: `bun run check-types && bun run lint`

---

### Task 4: 10d — the ring opens into the week

**Objective:** Give the streak number depth on demand: tapping the summary line beneath the ring unfolds a seven-day strip, each day's dot dealing in with a 40ms stagger. Seeing six filled days and one still open is a stronger pull than any counter.

**Files:**

- Modify: `apps/web/src/lib/rewards.ts`
- Modify: `apps/web/src/lib/rewards.test.ts`
- Modify: `apps/web/src/routes/home.tsx`

**Key Decisions / Notes:**

- **The toggle is the summary line, not the ring.** 9b already owns a tap target inside the ring, and `<button>` inside `<button>` is invalid. The strip unfolds directly beneath the summary block — visually still under the ring, with no nested targets.
- **Scope the button to the reviews-count line only, and to phrasing content.** The block at `home.tsx:269-279` holds *two* paragraphs: the reviews count (`:270-273`) and the streak lock-in message (`:274-278`). Only the first becomes the toggle, and it must become the `<button>` rather than be wrapped by one — `<button>`'s content model is phrasing content, so a `<p>` inside it is non-conforming. Replace that `<p>` with a `<button aria-expanded>` carrying the same text spans and text styling. The streak lock-in `<p>` stays a plain sibling *outside* the button, so the toggle's accessible name is the goal count alone and does not concatenate the unrelated streak message.
- Add `weekStrip(stats, goal)` to `lib/rewards.ts` returning seven entries oldest→today as `{ day, reviews, state: 'met' | 'partial' | 'open' }`: `met` when `reviews >= goal`, `partial` when `0 < reviews < goal`, `open` at zero. Build the day keys with the same UTC arithmetic `deriveRewards` already uses via `utcToday()` (`rewards.ts:379-380`) — see Assumptions.
- **`partial` replaces the design's "kept" (grace) state.** `hasGraceDay()` (`rewards.ts:184`) answers a whole-streak question, not a per-day one, so reconstructing per-day grace semantics would mean inventing them. A partial day is derivable, honest, and carries the same "you showed up but fell short" meaning; it renders with the dashed outline the design gave "kept".
- Extend `rewards.test.ts`: seven entries returned, ordering is oldest→today, and the three states classify correctly at the `reviews == goal` and `reviews == 0` boundaries.
- Unfold via `max-height` + `overflow-hidden` transition (260ms), dots carrying `animate-dot-in` with an inline `animationDelay` of `i * 40`ms.
- Each dot needs a visible weekday label and must not encode its state in colour alone — filled dots carry the flame glyph the design uses, open dots stay empty with an outline.
- Reduced motion: Task 1's delay reset plus the global override means the strip appears already open with no unfold and no stagger — the design's stated fallback.
- Do not touch `MasteryChart` — it answers a different question (30 days of volume) and keeps its own local `utcDayKey`.

**Definition of Done:**

- [ ] Clicking the reviews-count line beneath the ring unfolds a seven-day strip and toggles its `aria-expanded`
- [ ] The toggle's accessible name is the reviews-count text alone — the streak lock-in message sits outside the button — and the button contains no flow-content elements
- [ ] The strip shows seven days oldest→today, each with a weekday label, correctly classified met / partial / open against the derived goal
- [ ] Dots deal in with a stagger on open; the strip folds away on a second click
- [ ] Day state is distinguishable without colour
- [ ] Clicking the flame inside the ring does not open or close the strip
- [ ] Verify: `bun run test && bun run check-types && bun run lint`

---

### Task 5: 10a — XP bar grows an approach node

**Objective:** Make the home screen lean toward one more session when a level is nearly in reach: inside the last stretch of a level the XP bar's end grows a pulsing node, and the "XP to next level" counter rolls rather than snapping. This is the only ambient motion in the app, and it only exists when a level is close.

**Files:**

- Modify: `apps/web/src/components/home/LevelStrip.tsx`

**Key Decisions / Notes:**

- Everything needed is already on `RewardState` (`rewards.ts:351-374`): `xpToNext`, `levelProgress`, `levelFloor`, `levelCeil`, `level`, `levelTitle`.
- **Keep the design's flat 200 XP threshold — it is already well calibrated to this app.** `LEVEL_AT` (`rewards.ts:33`) is `[0, 500, 1500, 3500, 7500, 15500, 27500, 44000, 65000, 92000, 126000, 168000]`, and the design's own demo used the 7500→15500 band, so the scales match. More importantly 200 XP is almost exactly one good day at this app's rates (`XP.perRating` 10 × a 12-review goal + `XP.goalMet` 30 = 150; a 20-review day = 230), which is precisely the "one more session gets you there" semantic the node is for. A share-of-band rule was considered and rejected: at 10% it would glow for 4200 XP — weeks — inside the top band.
- **Guard the top level:** `xpToNext === null` and `levelCeil === null` at the cap (`rewards.ts:356-357`, `levelFor` returns `ceil: null` for the last entry). Render no node and keep the strip's existing "Top level reached" copy (`LevelStrip.tsx:16`). Since 200 is below even the narrowest band (500, level 1→2), no clamp against the band width is needed.
- The node sits at the **end of the track** (the level ceiling), not at the fill's leading edge — it marks the goal, matching the design's `right:-3px` placement. Absolutely positioned against the track, carrying `animate-pulse-end`.
- The track currently clips its fill via `overflow-hidden` on `ProgressBar` (`Progress.tsx:45`). The node must sit **outside** that clip — render it as a sibling of `<ProgressBar>` inside a `relative` wrapper, not by changing `ProgressBar`, whose four other callers must stay untouched.
- Swap the `{group(xpToNext)} XP to level N` text (`LevelStrip.tsx:16`) to use the existing `<CountUp>`, which already rolls 420ms and already renders the final value immediately under reduced motion (`CountUp.tsx:43`).
- The level-crossing celebrate edge is **not** built — see Out of Scope.
- Reduced motion: the global override reduces `pulse-end` to a single 1ms iteration, leaving the node visible and static at full size — the design's stated fallback.

**Definition of Done:**

- [ ] A pulsing node appears at the end of the XP track only when `xpToNext <= 200`
- [ ] The "XP to level N" counter rolls up to its value
- [ ] At the top level (`xpToNext === null`) no node renders, nothing divides by null, and the existing "Top level reached" copy is unchanged
- [ ] The node is not clipped by the progress track's `overflow-hidden`
- [ ] `ProgressBar`'s other four callers are visually unchanged
- [ ] Verify: `bun run check-types && bun run lint`

---

### Task 6: 10b + 10c — mode cards become browsable and explain themselves

**Objective:** Make Home's mode cards worth touching without committing to a session: hold a plain mode card to peek at how that mode is actually going, and tap the suggested card's badge to flip it over and see the real reason it was suggested. A plain tap still launches the mode. The two gestures live on different cards, so neither can shadow the other.

**Files:**

- Modify: `apps/web/src/components/home/ModeCard.tsx`
- Modify: `apps/web/src/routes/home.tsx`

**Key Decisions / Notes:**

- **Hold-to-peek applies to plain `ModeCard` only; `SuggestedModeCard` gets the flip only.** The two overlays are therefore never open on the same card and no mutual-exclusion state is needed. This is not an arbitrary split: the suggested card already renders its accuracy chip and comparison note inline (`ModeCard.tsx:60-67`), so a peek there would unfold information the user can already see, and the "Why this?" flip already serves that card's "tell me more" job.
- **Peek content is limited to what `StatsDto` returns** — accuracy, the correct/attempts split, and the mode's rank among graded modes. There is no sparkline and no time series; see Out of Scope. This makes the peek thinner than the design's mock, and that is the honest ceiling of the current API. `home.tsx` already computes `pct()` and `suggestedMode()` (`home.tsx:57`, `:69`) — pass the derived figures down rather than recomputing in the card.
- **Hold vs tap on a `<Link>`:** open the peek only after ~180ms of press, so a quick tap never flashes it. On release, if the peek had opened, `preventDefault()` the click so the app does not navigate; if it had not, let the click through. `pointercancel` (a touch that became a scroll) closes the peek and suppresses nothing.
- Unfold via `max-height` + `opacity` transition (240ms), matching the design.
- Keyboard users reach every mode by activating the `<Link>` as before. The peek is pointer-only and purely supplementary — no information is available *only* through it.
- **10c must not nest a `<button>` inside an `<a>`.** Restructure `SuggestedModeCard`: the card becomes a `<div>`; the `<Link>` covers the tap area via the stretched-link pattern (a `::after` spanning the card); the "Why this?" `<button>` sits above it with its own stacking context. The badge is then a sibling of the link, not a descendant.
- Flip with `transform-style: preserve-3d` and `backface-visibility: hidden`, 420ms on Y. **The face that is turned away must leave the tab order and the accessibility tree** (`inert`, or `tabIndex={-1}` plus `aria-hidden`) — otherwise focus lands on an invisible link.
- The reasoning text states the real rule and the real numbers: the weakest graded mode at its accuracy over its attempt count, plus why Learn is excluded (its "accuracy" is the share of self-ratings at Good or better, which is not comparable — the reasoning already documented at `home.tsx:64-68`). No invented statistics.
- Reduced motion needs the hook: under `prefers-reduced-motion` there is no rotation — the reasoning renders as a plain panel below the card, which is the design's stated fallback and a different DOM shape, not just a frozen animation.

**Definition of Done:**

- [ ] Holding a plain (non-suggested) mode card for ~1s unfolds a panel with that mode's real accuracy, correct/attempts split and rank; releasing folds it and does not navigate
- [ ] The suggested card does not peek — it carries the flip only, so the two overlays can never both be open
- [ ] A quick tap on any mode card navigates to that mode exactly as before
- [ ] A touch drag that starts on a card scrolls the page and closes any open peek
- [ ] Clicking "Why this?" flips the suggested card to a reasoning face citing real figures, without navigating
- [ ] No `<button>` is rendered inside an `<a>`, and the turned-away face is unreachable by keyboard and hidden from assistive tech
- [ ] Under `prefers-reduced-motion: reduce` the reasoning appears as a panel below the card with no rotation
- [ ] Verify: `bun run check-types && bun run lint`

---

### Task 7: 10e — the header knows what time it is

**Objective:** Make a second daily visit feel like a different visit: Home's header cross-fades between morning, afternoon and night palettes with a matching greeting and a supporting line tied to what is left of today's goal.

**Files:**

- Modify: `apps/web/src/lib/clock.ts`
- Create: `apps/web/src/lib/clock.test.ts` (added at verification — `timeOfDay` is pure and boundary-sensitive)
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/src/routes/home.tsx`

**Key Decisions / Notes:**

- Add `timeOfDay(date): 'morning' | 'afternoon' | 'night'` to `lib/clock.ts`, beside the existing `weekday` and `clockTime`. Home already holds a live clock via `useNow()` (`home.tsx:189`) that ticks once a minute — no new timer.
- **Do not hard-code the design's hex gradients.** They would break the app's dark theme, which flips every colour token (`index.css:124-158`). Instead add `--tod-{morning,afternoon,night}-bg` and matching `--tod-*-fg` / `--tod-*-muted` tokens to `@theme static` with `.dark` overrides, following the pattern the file already uses. Contrast must be measured on each palette in both themes — body ≥4.5:1, the large greeting ≥3:1.
- **Merge the greeting, do not stack two.** `home.tsx:250-256` already renders an `<h1>` that varies by goal state ("Goal met today" / "Keep it going" / "Welcome back"). The `<h1>` becomes the time-of-day greeting; the goal-state message moves down into 10e's supporting line, which the design also wants tied to the remaining goal (`remaining` is already computed at `home.tsx:233`). The weekday/time line above is unchanged.
- Cross-fade via `transition` on background and colour (500ms). Because the palette only changes when the hour bucket changes, this transition fires at most a few times a day and is not ambient motion.
- Reduced motion: the global override collapses the fade; the palette, greeting and line still change. That is the design's stated fallback.

**Definition of Done:**

- [ ] The header's palette, greeting and supporting line all change across morning / afternoon / night
- [ ] Exactly one greeting is shown — the goal-state message appears as the supporting line, not as a second heading
- [ ] The weekday and clock line is unchanged
- [ ] Measured contrast on all three palettes in both light and dark themes: body ≥4.5:1, greeting ≥3:1
- [ ] Palettes are defined as tokens with `.dark` overrides, not as inline hex values
- [ ] Verify: `bun run check-types && bun run lint`

---

### Task 8: 9c — quiz question card gains combo heat

**Objective:** Make the answer streak ambient instead of numeric: the question card gains a flame border and a glow that thickens at combo ×2, ×4 and ×6, so breaking the run has a felt cost beyond the counter resetting. A wrong answer snuffs the glow with a single shake.

**Files:**

- Modify: `apps/web/src/components/quiz/QuizCard.tsx`

**Key Decisions / Notes:**

- `combo` is already a prop (`QuizCard.tsx:34`) and `quiz.tsx:139-141` already maintains it — no state changes outside this component.
- Add a module-local `heatShadow(combo)` returning the box-shadow for the ≥6 / ≥4 / ≥2 / none steps. Keep it untested: three branches over a prop, fully exercised by TS-005 steps 2–4.
- Apply border and shadow to the prompt card at `QuizCard.tsx:87` with `transition-[box-shadow,border-color] duration-[400ms]`.
- **Move the wrong-answer shake from the option to the card.** `QuizCard.tsx:123` currently puts `animate-nudge` on the chosen wrong option. 9h is explicit — "one shake, never more" — and shaking both would be two. The wrong option keeps its cross icon, "Your pick" tag and red fill; only the shake relocates. This is the one behaviour change in this task that is not purely additive.
- Shake trigger: `locked && chosen !== question.answer`. No key needed — `locked` flips false→true once per question and back on advance, so the class is genuinely added and removed each round.
- Nothing may animate while a question is unanswered (9h). The glow is a static box-shadow that only *transitions* at the moment an answer lands; it never pulses.
- Reduced motion: the global override makes the glow step instantly and drops the shake. The flame border and the `×N` chip still carry the combo state — the design's stated fallback.

**Definition of Done:**

- [ ] The card is unglowed at combo 0–1 and gains a visibly thicker glow at each of ×2, ×4 and ×6
- [ ] A wrong answer clears the glow and shakes the question card exactly once
- [ ] The chosen wrong option keeps its cross icon, red fill and "Your pick" tag, and no longer shakes independently
- [ ] Nothing on the card animates while a question sits unanswered
- [ ] Verify: `bun run check-types && bun run lint`

---

### Task 9: 9d — Learn's reveal cover leans toward the pointer

**Objective:** Make the "Reveal meaning" cover read as a physical card about to be turned over: it tilts up to ±7° toward the pointer and follows within ~160ms, so the reveal feels earned rather than switched on. Scoped strictly to the one expanded row's cover, never to the list.

**Files:**

- Modify: `apps/web/src/components/learn/WordRow.tsx`

**Key Decisions / Notes:**

- Target is the reveal cover button at `WordRow.tsx:122-133` only. It renders solely inside the `open` branch, so at most one exists at a time and collapsed rows are structurally incapable of tilting — which is how 9h's "245 rows must feel like paper" rule stays intact.
- Wrap the button in a `perspective` container and drive `rotateX`/`rotateY` from the pointer's position within the button's own `getBoundingClientRect()`, clamped to ±7°.
- **Do not set `touch-action: none`** (the design demo does). This button lives inside the virtualiser's scroll container, and disabling touch scrolling over it would trap a thumb drag. Reset the tilt on `pointerleave`, `pointerup` **and `pointercancel`** — a touch that becomes a scroll fires `pointercancel`, releasing the tilt cleanly.
- Pointer tracking must not swallow the click: `onPointerMove` only sets transform state; the existing `onClick` → `onReveal()` path and its `e.stopPropagation()` are untouched.
- Reduced motion needs the hook: a pointer-following 3D transform is precisely what a motion-sensitive user opts out of, and the global override would only make it *snap* rather than stop. Call `usePrefersReducedMotion()` and skip tilt entirely — the design's own fallback is "no tilt".
- The virtualiser positions each row with its own `translateY` (`learn.tsx:307`). Keep the perspective and tilt strictly inside the row's subtree so the two transform contexts never fight.

**Definition of Done:**

- [ ] Moving a pointer across the open row's reveal cover tilts it toward the pointer, capped at ±7°
- [ ] Leaving, releasing or cancelling the pointer returns it to flat
- [ ] Clicking the cover still reveals the definition and enables the rating bar
- [ ] Collapsed rows never tilt, and a touch drag over the cover scrolls the list normally
- [ ] Under `prefers-reduced-motion: reduce` the cover does not tilt at all
- [ ] Verify: `bun run check-types && bun run lint`

---

### Task 10: 9e — Word Rush headword letters deal in

**Objective:** Fill the dead beat between Word Rush cards with rhythm: each new headword's letters arrive staggered like a dealt hand instead of appearing whole, keeping the 90-second cadence alive without ever making the player wait to answer.

**Files:**

- Modify: `apps/web/src/components/game/RushCard.tsx`

**Key Decisions / Notes:**

- Split `card.headword` (`RushCard.tsx:89`) into one `<span>` per character, each `inline-block` with `animate-letters-in` and an inline `animationDelay` of `i * 18`ms. Total under ~320ms for the longest headword.
- **Accessibility is the load-bearing detail.** Per-character spans make some screen readers spell the word out. Put `aria-label={card.headword}` on the wrapping element and `aria-hidden` on the letter spans, so the headword is still announced as one word.
- No change to `game.tsx`: `RushCard` already gets `key={s.index}` (`game.tsx:298`), so each card is a fresh mount and the cascade replays for free. Recorded under Assumptions because removing that key would silently kill the effect.
- The cascade is decorative only — the swipe handlers and both judgment buttons are live from the first frame, and nothing gates on animation completion.
- Preserve the existing long-word type-scale branch at `RushCard.tsx:84-88` (`longWord` switches 38px → 30px); the split must not change which branch applies.
- Render any space character as a non-breaking space so a multi-word headword does not collapse.
- Reduced motion: the global override plus Task 1's `animation-delay: 0ms` reset means every letter lands on frame one — the word simply appears whole, the design's stated fallback.

**Definition of Done:**

- [ ] A new card's headword letters arrive staggered, and the cascade replays on each subsequent card
- [ ] The headword is announced as a single word by assistive tech, not letter by letter
- [ ] Judging a card while its letters are still arriving registers immediately
- [ ] Long headwords still use the smaller type scale
- [ ] Under `prefers-reduced-motion: reduce` the whole word is visible on the first frame
- [ ] Verify: `bun run check-types && bun run lint`

---

### Task 11: 9f — Progress bars perform on entry and the headline rolls up

**Objective:** Stop the Progress screen from being a spreadsheet: the accuracy bars grow left-to-right with a stagger as their card scrolls into view, and the "Mastered" headline rolls up to its value. Checking your stats becomes a small show, once per visit.

**Files:**

- Modify: `apps/web/src/lib/motion.ts`
- Modify: `apps/web/src/components/ui/Progress.tsx`
- Modify: `apps/web/src/components/stats/ModeAccuracy.tsx`
- Modify: `apps/web/src/components/stats/MasteryHero.tsx`

**Key Decisions / Notes:**

- Add `useInView()` to the existing `lib/motion.ts` rather than a new file — it is a motion concern, the file is 23 lines, and `usePrefersReducedMotion` already lives there.
- `useInView` latches: once true it stays true, so scrolling away and back does not replay (9f is explicitly "once per visit").
- **Guard the missing-API case:** if `typeof IntersectionObserver === 'undefined'`, return `true` immediately. Without it a bar gated on visibility would sit at zero forever — a silent data-hiding bug, not a missing flourish.
- Growth reuses `ProgressBar`'s existing `transition-[width] duration-[420ms]` (`Progress.tsx:54`) — feed it `value={visible ? real : 0}` and the transition *is* the animation. No new keyframe, no `scaleX`.
- Add one optional `delayMs` prop to `ProgressBar`, applied as `transitionDelay` on the fill div; `ModeAccuracy` passes `index * 90`. Its four existing callers (`LevelStrip.tsx:19`, `LevelUpSheet.tsx:69`, `BadgeGrid.tsx:57`, `ModeAccuracy.tsx:39`) are unaffected by an optional prop defaulting to no delay. Note Task 5 also touches `LevelStrip`'s use of this component — land whichever comes second on top of the other.
- `MasteryHero`'s headline swaps `group(mastered)` (`MasteryHero.tsx:31`) for the existing `<CountUp to={mastered} />`, which already rolls 420ms and renders the final value immediately under reduced motion (`CountUp.tsx:43`). Keep `tabular` so the figure does not jitter.
- `MasteryChart` is deliberately untouched — see Out of Scope.
- Reduced motion: Task 1's `transition-delay: 0ms` reset plus the global 1ms duration means bars snap to their true width the moment their card enters view. The number and the bar length still carry the value.

**Definition of Done:**

- [ ] Scrolling "Accuracy by mode" into view grows its bars left-to-right, staggered ~90ms apart, ending at each mode's true percentage
- [ ] Scrolling away and back leaves the bars at final width — the entry plays once
- [ ] The "Mastered" headline rolls up to its final value on load
- [ ] With `IntersectionObserver` unavailable, bars render at their true width rather than at zero
- [ ] `BadgeGrid`'s and `LevelStrip`'s progress bars are visually unchanged
- [ ] Verify: `bun run check-types && bun run lint`

---

### Task 12: 9g — earned badges take a polish while held

**Objective:** Give the trophy case a reason to be visited after the unlock moment has passed: press and hold an earned badge and a sheen sweeps across it while it swells slightly, like polishing a medal. Releasing springs it back. This task also closes out the plan's documentation debt, since it is the last one to land.

**Files:**

- Modify: `apps/web/src/components/reward/BadgeGrid.tsx`
- Modify: `README.md`

**Key Decisions / Notes:**

- Target the earned-badge tile at `BadgeGrid.tsx:31-36`. Keep it a `<span>` — **do not promote it to a `<button>`.** The effect is purely decorative, and turning eight-plus badges into focusable no-op buttons would add tab stops that announce an action and then do nothing. The existing `title={b.condition}` stays.
- Track a single `held` badge id in state, set on `pointerdown` and cleared on `pointerup`, `pointerleave` and `pointercancel`. `pointercancel` is what releases the badge when a touch becomes a page scroll — the same reasoning as Task 9, and why no `touch-action` override is used.
- Multi-touch holding two badges resolves to the last pressed. Acceptable for a decorative flourish; no per-badge state map.
- Held styling: `--animate-sheen-hold` (Task 1) over an inline gradient background with an explicit `background-size`, plus `scale-[1.06]` with a `200ms var(--ease-spring)` transition. The `sheen` keyframe animates `background-position`, so the gradient and its size must sit on the same element.
- Reduced motion needs the hook: `--animate-sheen-hold` is an infinite loop and a 6% scale pop is exactly what the design's fallback removes. Call `usePrefersReducedMotion()` and, when true, apply only a one-step brightening of the badge tint — no sweep, no scale.
- Locked badges (`BadgeGrid.tsx:45-68`) are untouched — an unearned badge is a stated goal, not a thing to polish.
- **README sync.** `README.md:154-162` currently describes the motion layer as "the named motions from the design's motion table — every one with a `prefers-reduced-motion` fallback". After this plan that is incomplete: there is now a delight layer of twelve interactive surfaces on top. Extend that paragraph (a few sentences, not a new section) to name the delight layer and restate that the reduced-motion contract still holds for every one of them. Do not restructure the surrounding sections.

**Definition of Done:**

- [ ] Pressing and holding an earned badge sweeps a sheen across it and swells it ~6%; releasing springs it back
- [ ] A touch drag starting on a badge releases the hold and scrolls the page normally
- [ ] Earned badges add no new tab stops, and their icon, tint, name and `title` are unchanged
- [ ] Locked badges are visually and behaviourally unchanged
- [ ] Under `prefers-reduced-motion: reduce` a hold brightens the badge one step with no sweep and no scale
- [ ] `README.md`'s design-system section describes the delight layer and its reduced-motion contract, with no other section restructured
- [ ] Verify: `bun run check-types && bun run lint`
