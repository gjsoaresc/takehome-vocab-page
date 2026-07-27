import type { ReactNode } from 'react'

/** Shared loading / error / empty states so no screen is ever blank. */

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted" role="status">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" />
      <p className="text-sm">{label}&hellip;</p>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center" role="alert">
      <p className="font-semibold">Something went wrong</p>
      {message ? <p className="max-w-xs text-sm text-muted">{message}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="tap rounded-lg bg-accent px-5 font-medium text-white active:bg-accent-strong"
        >
          Try again
        </button>
      ) : null}
    </div>
  )
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <p className="font-semibold">{title}</p>
      {hint ? <p className="max-w-xs text-sm text-muted">{hint}</p> : null}
      {action}
    </div>
  )
}
