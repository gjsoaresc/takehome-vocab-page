import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export type ChipTone = 'accent' | 'flame' | 'xp' | 'gold' | 'ok' | 'err' | 'warn' | 'outline'

/** Chip: h32, pill, 12.5px semibold - design variant 1c. */
const CHIP_TONES: Record<ChipTone, string> = {
  accent: 'bg-accent-soft text-accent-strong',
  flame: 'bg-flame-soft text-flame',
  xp: 'bg-xp-soft text-xp',
  gold: 'bg-gold-soft text-gold',
  ok: 'bg-ok-soft text-ok',
  err: 'bg-err-soft text-err',
  warn: 'bg-warn-soft text-warn',
  outline: 'border border-line bg-transparent text-muted',
}

interface ChipProps {
  tone?: ChipTone
  icon?: IconName
  /** Solid glyph rather than a stroked one (flames, stars). */
  iconFilled?: boolean
  className?: string
  children: ReactNode
}

export function Chip({
  tone = 'outline',
  icon,
  iconFilled = false,
  className = '',
  children,
}: ChipProps) {
  return (
    <span
      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] leading-none font-semibold ${CHIP_TONES[tone]} ${className}`}
    >
      {icon ? <Icon name={icon} size={13} filled={iconFilled} strokeWidth={2.2} /> : null}
      {children}
    </span>
  )
}

export type PillTone = 'suggested' | 'new' | 'risk' | 'locked'

/** Pill badge: h20, uppercase 10px/700 - design variant 1c. */
const PILL_TONES: Record<PillTone, string> = {
  suggested: 'bg-xp text-on-xp',
  new: 'bg-gold-soft text-gold',
  risk: 'bg-warn-soft text-warn',
  locked: 'bg-line text-muted',
}

export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-5 items-center rounded-full px-2 text-[10px] leading-none font-bold tracking-[0.04em] uppercase ${PILL_TONES[tone]}`}
    >
      {children}
    </span>
  )
}
