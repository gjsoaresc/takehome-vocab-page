import { useEffect, useState, type ReactNode } from 'react'
import { Button } from './ui/Button'
import { CARD } from './ui/Card'
import { Icon, type IconName } from './ui/Icon'
import { Skeleton } from './ui/Skeleton'

/**
 * Every non-happy state, so no screen ever renders raw or blank.
 * Shapes and copy follow docs/design/SAT Vocab States.dc.html (variant 8a).
 */

/* -------------------------------------------------------------------------- */
/* Loading                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Holds `active` true for at least `ms` once it has been true, so a fast
 * response cannot flash a skeleton on and straight back off. Design asks 400ms.
 */
export function useMinimumDuration(active: boolean, ms = 400): boolean {
  // Each load gets a run id. A timer marks that run's floor as elapsed, so the
  // skeleton can only disappear once its own floor has passed - no clock is
  // read during render, and no state is assigned inside the effect body.
  const [run, setRun] = useState(active ? 1 : 0)
  const [wasActive, setWasActive] = useState(active)
  const [floorDoneFor, setFloorDoneFor] = useState(0)

  if (active !== wasActive) {
    setWasActive(active)
    if (active) setRun((r) => r + 1)
  }

  useEffect(() => {
    if (run === 0) return
    const timer = setTimeout(() => setFloorDoneFor(run), ms)
    return () => clearTimeout(timer)
  }, [run, ms])

  return active || (run !== 0 && floorDoneFor < run)
}

/** App-boot state: the one place with no block geometry to mirror yet. */
export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted" role="status">
      <Icon name="spinner" size={24} strokeWidth={2.6} className="animate-spin-slow" />
      <p className="text-sm">{label}...</p>
    </div>
  )
}

const Bars = ({ widths }: { widths: string[] }) => (
  <div className="flex flex-col gap-[7px]">
    {widths.map((w, i) => (
      <Skeleton key={i} width={w} height={12} />
    ))}
  </div>
)

export function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading your progress">
      <div className={`${CARD} flex items-center gap-3 p-4`}>
        <Skeleton width={96} height={96} rounded={999} />
        <div className="flex-1">
          <Bars widths={['65%', '45%', '100%']} />
        </div>
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`${CARD} flex items-center gap-3 p-4`}>
          <Skeleton width={44} height={44} rounded={14} />
          <div className="flex-1">
            <Bars widths={['55%', '80%']} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className={`${CARD} p-4`} role="status" aria-label="Loading words">
      <div className="flex flex-col gap-4">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton width={['62%', '78%', '48%'][i % 3]} height={11} className="flex-1" />
            <Skeleton width={58} height={20} rounded={999} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function QuizSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Building your quiz">
      <Skeleton height={6} rounded={3} />
      <div className={`${CARD} p-5`}>
        <Skeleton width="40%" height={11} />
        <Skeleton height={34} rounded={10} className="mt-3" />
      </div>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} height={56} rounded={16} />
      ))}
    </div>
  )
}

export function BoardSkeleton() {
  return (
    <div className="grid grid-cols-[146px_1fr] gap-2.5" role="status" aria-label="Dealing a board">
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} height={56} rounded={16} />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {[56, 74, 56, 92, 56, 74].map((h, i) => (
          <Skeleton key={i} height={h} rounded={16} />
        ))}
      </div>
    </div>
  )
}

const STATS_BARS = [
  22, 40, 14, 52, 30, 8, 46, 26, 58, 18, 36, 12, 48, 24, 42, 16, 54, 28, 34, 20, 50, 10, 38, 44,
  22, 32, 56, 18, 40, 26,
]

export function StatsSkeleton() {
  return (
    <div className="flex flex-col gap-3.5" role="status" aria-label="Loading your progress">
      <div className={`${CARD} p-4`}>
        <Skeleton width="35%" height={12} />
        <Skeleton width="58%" height={34} rounded={10} className="mt-2.5" />
        <Skeleton height={14} rounded={999} className="mt-4" />
      </div>
      <div className={`${CARD} p-4`}>
        <Skeleton width="30%" height={11} />
        <div className="mt-3.5 flex h-[66px] items-end gap-1">
          {STATS_BARS.map((h, i) => (
            <Skeleton key={i} height={h} rounded={3} className="flex-1" />
          ))}
        </div>
      </div>
      <div className={`${CARD} flex flex-col gap-3 p-4`}>
        {['40%', '55%', '32%', '48%'].map((w, i) => (
          <div key={i}>
            <Skeleton width={w} height={11} />
            <Skeleton height={10} rounded={999} className="mt-1.5" />
          </div>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Empty - a cause and one real action                                        */
/* -------------------------------------------------------------------------- */

interface EmptyStateProps {
  title: string
  /** Why the screen is empty, in plain language. */
  hint?: string
  /** Which surface this is, in the API's own language. */
  where?: string
  icon?: IconName
  /** A ready-made control, when the caller needs a link rather than a button. */
  action?: ReactNode
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({
  title,
  hint,
  where,
  icon = 'info',
  action,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className={`${CARD} flex items-start gap-3 p-3.5`}>
      <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[13px] border border-line bg-paper text-muted">
        <Icon name={icon} size={19} />
      </span>
      <div className="min-w-0 flex-1">
        {where ? <div className="font-mono text-[10px] text-muted">{where}</div> : null}
        <p className="mt-1 text-sm leading-[19px] font-bold text-ink">{title}</p>
        {hint ? <p className="mt-0.5 text-xs leading-[17px] text-muted">{hint}</p> : null}
        {action ??
          (actionLabel ? (
            <Button onClick={onAction} className="mt-2.5 !h-9 text-[12.5px]">
              {actionLabel}
            </Button>
          ) : null)}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Error - plain cause, retry, nothing lost                                   */
/* -------------------------------------------------------------------------- */

interface ErrorStateProps {
  /** Kept as `message` so existing call sites do not have to change. */
  message?: string
  title?: string
  onRetry?: () => void
  retryLabel?: string
  /** The second door: something useful to do instead of retrying. */
  altLabel?: string
  onAlt?: () => void
}

export function ErrorState({
  message,
  title = 'Something went wrong',
  onRetry,
  retryLabel = 'Try again',
  altLabel,
  onAlt,
}: ErrorStateProps) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl border-[1.5px] border-err bg-card p-3.5"
      role="alert"
    >
      <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[13px] bg-err-soft text-err">
        <Icon name="alert" size={19} strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-[19px] font-bold text-ink">{title}</p>
        {message ? <p className="mt-0.5 text-xs leading-[17px] text-muted">{message}</p> : null}
        <div className="mt-2.5 flex gap-1.5">
          {onRetry ? (
            <Button onClick={onRetry} className="!h-9 text-[12.5px]">
              {retryLabel}
            </Button>
          ) : null}
          {altLabel ? (
            <Button variant="ghost" onClick={onAlt} className="!h-9 text-[12.5px]">
              {altLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Offline - visible, never lost                                              */
/* -------------------------------------------------------------------------- */

/** Banner above the content while writes are waiting to sync. */
export function OfflineBanner({ pending, onRetry }: { pending: number; onRetry: () => void }) {
  if (pending === 0) return null
  return (
    <div
      className="flex items-center gap-2.5 rounded-lg border border-warn bg-warn-soft px-3 py-2.5"
      role="status"
    >
      <Icon name="offline" size={16} strokeWidth={2.2} className="flex-none text-warn" />
      <span className="flex-1 text-[12.5px] leading-[17px] font-semibold text-ink">
        Offline - you can keep studying
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="font-mono text-[11px] font-semibold text-warn underline-offset-2 hover:underline"
      >
        {pending} queued
      </button>
    </div>
  )
}

/** Per-row transport chip. It reports delivery only - the row already updated. */
export function SyncChip({ state }: { state: 'queued' | 'synced' }) {
  const queued = state === 'queued'
  return (
    <span
      className={`inline-flex h-[26px] flex-none items-center gap-1.5 rounded-full px-2.5 text-[11px] leading-none font-bold ${
        queued ? 'bg-warn-soft text-warn' : 'animate-pop bg-ok-soft text-ok'
      }`}
    >
      <Icon
        name={queued ? 'spinner' : 'check'}
        size={12}
        strokeWidth={3}
        className={queued ? 'animate-spin-slow' : undefined}
      />
      {queued ? 'Queued' : 'Synced'}
    </span>
  )
}
