import { useQuery } from '@tanstack/react-query'
import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { api } from '../lib/api'
import { flush, pendingCount, subscribe, watchConnection } from '../lib/outbox'
import { getStoredGoal, getXpFloor } from '../lib/reward-store'
import { deriveRewards } from '../lib/rewards'
import { useTheme } from '../lib/theme'
import { useUserId } from '../lib/user-context'
import { OfflineBanner } from './States'
import { Icon, type IconName } from './ui/Icon'

const NAV: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/learn', label: 'Learn', icon: 'words' },
  { to: '/quiz', label: 'Quiz', icon: 'quiz' },
  { to: '/matching', label: 'Match', icon: 'match' },
  { to: '/game', label: 'Rush', icon: 'rush' },
  { to: '/stats', label: 'Progress', icon: 'stats' },
]

/**
 * Routes that own their whole viewport. The design's surfacing table puts the
 * level chip on the home hub and marks it "absent - no distraction mid-run";
 * both of these screens carry their own in-screen chrome instead.
 */
const NO_TOP_BAR = new Set(['/quiz', '/game'])

function LevelChip() {
  const userId = useUserId()
  const stats = useQuery({ queryKey: ['stats', userId], queryFn: () => api.stats(userId) })
  if (!stats.data) return <span className="h-8" />
  const { level, levelTitle } = deriveRewards(stats.data, {
    xpFloor: getXpFloor(),
    storedGoal: getStoredGoal(),
  })
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-xp-soft px-3 text-[12.5px] leading-none font-semibold text-xp">
      <span className="tabular font-extrabold">L{level}</span>
      {levelTitle}
    </span>
  )
}

function ThemeToggle() {
  const [theme, choose] = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      onClick={() => choose(next)}
      aria-label={`Switch to ${next} theme`}
      className="tap grid place-items-center rounded-full text-muted transition-colors duration-[160ms] hover:text-ink"
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} strokeWidth={1.9} />
    </button>
  )
}

const usePending = () => useSyncExternalStore(subscribe, pendingCount, () => 0)

export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const pending = usePending()
  const showTopBar = !NO_TOP_BAR.has(pathname)

  useEffect(watchConnection, [])

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      {showTopBar ? (
        <header className="flex items-center justify-between px-4 pt-3">
          <LevelChip />
          <ThemeToggle />
        </header>
      ) : null}

      <main className="flex-1 px-4 pt-3 pb-24">
        {pending > 0 ? (
          <div className="mb-3">
            <OfflineBanner pending={pending} onRetry={() => void flush()} />
          </div>
        ) : null}
        {children}
      </main>

      <nav
        aria-label="Modes"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] shadow-e2"
      >
        <div className="mx-auto grid max-w-md grid-cols-6 px-1 pt-1.5 pb-2.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `tap flex flex-col items-center justify-center gap-[3px] rounded-md ${
                  isActive ? 'font-bold text-accent-strong' : 'font-medium text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={item.icon} size={22} strokeWidth={isActive ? 2.4 : 1.9} />
                  <span className="text-[10.5px] leading-none">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
