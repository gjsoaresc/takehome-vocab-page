import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from '../ui/Button'

/**
 * The large tier's shell: a bottom-anchored panel inside a 1.5px gradient edge.
 *
 * It renders OVER whatever session summary is underneath rather than replacing
 * it, dismisses in one tap, and never gates input. Under reduced motion the
 * global override drops the rise to 1ms so it is simply present at full state -
 * the copy says everything the animation would have.
 */
export function RewardSheet({
  onDismiss,
  dismissLabel = 'Nice',
  secondary,
  children,
  labelledBy,
}: {
  onDismiss: () => void
  dismissLabel?: string
  secondary?: { label: string; onClick: () => void }
  children: ReactNode
  labelledBy: string
}) {
  const panel = useRef<HTMLDivElement>(null)

  // Move focus to the sheet so a keyboard or screen-reader user lands on the
  // thing that just appeared, and let Escape dismiss it.
  useEffect(() => {
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="absolute inset-0 bg-ink/55"
      />
      <div className="celebrate animate-rise-sheet relative mx-3.5 mb-3.5 w-full max-w-md rounded-2xl p-[1.5px]">
        <div
          ref={panel}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          className="flex flex-col items-center rounded-[26.5px] bg-card px-5 pt-6 pb-5 outline-none"
        >
          {children}
          <Button full onClick={onDismiss} className="mt-4 !h-13 !rounded-lg text-base">
            {dismissLabel}
          </Button>
          {secondary ? (
            <Button variant="ghost" full onClick={secondary.onClick} className="mt-1.5">
              {secondary.label}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
