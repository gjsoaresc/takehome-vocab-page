/**
 * The only client-side state the reward layer keeps, and the only kind it is
 * allowed to keep: values that either PREVENT a number going backwards, or
 * record something the server has no field for.
 *
 * Nothing here is progress. Wipe it and the next GET /api/stats rebuilds every
 * level, badge and streak exactly as it was.
 */

const KEYS = {
  xpFloor: 'vocab.reward.xp_floor',
  goal: 'vocab.reward.goal',
  seenBadges: 'vocab.reward.seen_badges',
  bestRun: 'vocab.rush_best',
} as const

function readNumber(key: string): number | undefined {
  const raw = localStorage.getItem(key)
  if (raw === null) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

/** Highest XP ever displayed. Only ever raised. */
export const getXpFloor = () => readNumber(KEYS.xpFloor) ?? 0
export function rememberXp(xp: number): void {
  if (xp > getXpFloor()) localStorage.setItem(KEYS.xpFloor, String(xp))
}

/** The goal the learner is currently running. Absent until they accept one. */
export const getStoredGoal = () => readNumber(KEYS.goal)
export const setStoredGoal = (goal: number) => localStorage.setItem(KEYS.goal, String(goal))

/**
 * SHORTCUT: best Word Rush score is device-local. StatsDto carries no score
 * history and there is no read endpoint for game_finished payloads, so the
 * comparison is labelled "your best on this device" in the UI. Upgrade trigger:
 * add best_score to StatsDto if the comparison needs to follow the user.
 */
export const getBestRun = () => readNumber(KEYS.bestRun) ?? 0
export function rememberRun(score: number): boolean {
  const isBest = score > getBestRun()
  if (isBest) localStorage.setItem(KEYS.bestRun, String(score))
  return isBest
}

/**
 * Badge ids already celebrated. Seeded silently the first time so a returning
 * learner with six earned badges does not get six sheets on load.
 */
export function getSeenBadges(): Set<string> {
  try {
    const raw = localStorage.getItem(KEYS.seenBadges)
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export function markBadgesSeen(ids: string[]): void {
  const all = getSeenBadges()
  for (const id of ids) all.add(id)
  localStorage.setItem(KEYS.seenBadges, JSON.stringify([...all]))
}

/** True the first time this device computes badges - the seeding pass. */
export const hasSeenBadgesBefore = () => localStorage.getItem(KEYS.seenBadges) !== null
