import type { HTMLAttributes, ReactNode } from 'react'

/** Card: radius 22 / e1 / 1px line / pad 16 - design variant 1c. */
export const CARD = 'rounded-xl border border-line bg-card shadow-e1'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** Wrap the card in the reward gradient as a 1.5px edge. */
  celebrate?: boolean
}

export function Card({ children, celebrate = false, className = '', ...rest }: CardProps) {
  if (celebrate) {
    return (
      <div className="celebrate rounded-xl p-[1.5px]">
        <div {...rest} className={`rounded-[20.5px] bg-card p-4 ${className}`}>
          {children}
        </div>
      </div>
    )
  }
  return (
    <div {...rest} className={`${CARD} p-4 ${className}`}>
      {children}
    </div>
  )
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-[17px] leading-6 font-semibold text-ink">{children}</h2>
}

export function CardNote({ children }: { children: ReactNode }) {
  return <p className="mt-0.5 text-[13px] leading-[18px] text-muted">{children}</p>
}

/** Small uppercase section label. The dashboard convention, not a marketing eyebrow. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] leading-none font-semibold tracking-[0.08em] text-muted uppercase">
      {children}
    </div>
  )
}
