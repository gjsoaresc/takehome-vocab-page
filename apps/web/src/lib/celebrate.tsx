import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { BadgeSheet } from '../components/reward/BadgeSheet'
import { LevelUpSheet, type LevelUpPayload } from '../components/reward/LevelUpSheet'
import type { Badge } from './rewards'
import { getSeenBadges, hasSeenBadgesBefore, markBadgesSeen } from './reward-store'

/**
 * The celebration layer.
 *
 * Three tiers, from the design's tier table (variant 7d):
 *   micro   240ms  correct answer, word rated, pair matched  - owned by screens
 *   small   900ms  session or board complete, daily goal met - owned by screens
 *   large   1.6s   level-up, badge unlock, streak milestone  - owned by THIS file
 *
 * Two rules the large tier has to enforce centrally, which is why it lives in a
 * provider rather than in each screen:
 *   1. One large sheet per session. A level-up and a badge landing together
 *      queue into a single sheet with two rows, never two sheets in a row.
 *   2. A tier only fires for something the learner just did - never for opening
 *      the app. Badges already earned before this session are seeded silently.
 */

interface CelebrateApi {
  /** Announce a level-up. Ignored if a large tier already fired this session. */
  levelUp: (payload: LevelUpPayload) => void
  /**
   * Hand over the current badge list. Returns the badges that are newly earned
   * since the last call, having marked them seen. Safe to call on every stats
   * refresh; the first call on a device seeds silently and returns nothing.
   */
  reportBadges: (badges: Badge[]) => Badge[]
}

const CelebrateContext = createContext<CelebrateApi>({
  levelUp: () => {},
  reportBadges: () => [],
})

export const useCelebrate = () => useContext(CelebrateContext)

type Pending =
  | { kind: 'level'; payload: LevelUpPayload; badge?: Badge }
  | { kind: 'badge'; badge: Badge; all: Badge[] }

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [sheet, setSheet] = useState<Pending | null>(null)
  /** One large tier per session, per the design's rate limit. */
  const largeFired = useRef(false)
  /** A badge earned in the same beat as a level-up rides along on one sheet. */
  const freshBadge = useRef<Badge | null>(null)
  const allBadges = useRef<Badge[]>([])

  const levelUp = useCallback((payload: LevelUpPayload) => {
    if (largeFired.current) return
    largeFired.current = true
    setSheet({ kind: 'level', payload, badge: freshBadge.current ?? undefined })
  }, [])

  const reportBadges = useCallback((badges: Badge[]) => {
    allBadges.current = badges
    const earned = badges.filter((b) => b.earned)

    // First run on this device: record what is already earned without
    // celebrating any of it.
    if (!hasSeenBadgesBefore()) {
      markBadgesSeen(earned.map((b) => b.id))
      return []
    }

    const seen = getSeenBadges()
    const fresh = earned.filter((b) => !seen.has(b.id))
    if (fresh.length === 0) return []
    markBadgesSeen(fresh.map((b) => b.id))

    const first = fresh[0]!
    if (largeFired.current) {
      // A sheet already went up this session - remember it for the summary
      // rows the screens render, but do not stack a second sheet.
      return fresh
    }
    freshBadge.current = first
    largeFired.current = true
    setSheet({ kind: 'badge', badge: first, all: badges })
    return fresh
  }, [])

  const api = useMemo(() => ({ levelUp, reportBadges }), [levelUp, reportBadges])
  const dismiss = useCallback(() => setSheet(null), [])

  return (
    <CelebrateContext.Provider value={api}>
      {children}
      {sheet?.kind === 'level' ? (
        <LevelUpSheet payload={sheet.payload} alsoUnlocked={sheet.badge} onDismiss={dismiss} />
      ) : null}
      {sheet?.kind === 'badge' ? (
        <BadgeSheet
          badge={sheet.badge}
          familyEarned={
            sheet.all.filter((b) => b.family === sheet.badge.family && b.earned).length
          }
          familyTotal={sheet.all.filter((b) => b.family === sheet.badge.family).length}
          next={
            sheet.all.find((b) => b.family === sheet.badge.family && !b.earned) ??
            sheet.all.find((b) => !b.earned) ??
            null
          }
          onDismiss={dismiss}
        />
      ) : null}
    </CelebrateContext.Provider>
  )
}
