import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

/**
 * Toast: enters on a 240ms rise, holds 3.2s, dismissible by tap - design 1c.
 * It sits above the bottom nav and never in the path of the next question.
 */

export interface Toast {
  id: number
  title: string
  body?: string
  icon?: IconName
  tone?: 'ink' | 'gold'
  action?: { label: string; onClick: () => void }
}

type Push = (toast: Omit<Toast, 'id'>) => void

const ToastContext = createContext<Push>(() => {})

export const useToast = () => useContext(ToastContext)

const HOLD_MS = 3200

export function ToastHost({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((all) => all.filter((t) => t.id !== id))
  }, [])

  const push = useCallback<Push>(
    (toast) => {
      const id = nextId.current++
      setToasts((all) => [...all, { ...toast, id }])
      setTimeout(() => dismiss(id), HOLD_MS)
    },
    [dismiss],
  )

  const value = useMemo(() => push, [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md flex-col gap-2 px-4"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className="animate-rise pointer-events-auto flex w-full items-center gap-2.5 rounded-lg bg-ink p-3 text-left shadow-e3"
          >
            {t.icon ? (
              <Icon
                name={t.icon}
                size={20}
                className={t.tone === 'gold' ? 'text-gold' : 'text-paper'}
              />
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] leading-[1.3] font-semibold text-paper">
                {t.title}
              </span>
              {t.body ? (
                <span className="block text-[11.5px] leading-[1.3] text-paper/70">{t.body}</span>
              ) : null}
            </span>
            {t.action ? (
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation()
                  t.action?.onClick()
                  dismiss(t.id)
                }}
                className="flex h-8 flex-none items-center rounded-[10px] bg-paper/15 px-3 text-xs font-semibold text-paper"
              >
                {t.action.label}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
