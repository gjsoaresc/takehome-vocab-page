import type { CSSProperties, ReactNode } from 'react'
import { ringDash } from '../../lib/rewards'

type Tone = 'accent' | 'xp' | 'flame' | 'gold' | 'ok' | 'err'

const STROKE: Record<Tone, string> = {
  accent: 'var(--color-accent)',
  xp: 'var(--color-xp)',
  flame: 'var(--color-flame)',
  gold: 'var(--color-gold)',
  ok: 'var(--color-ok)',
  err: 'var(--color-err)',
}

const FILL: Record<Tone, string> = {
  accent: 'bg-accent',
  xp: 'bg-xp',
  flame: 'bg-flame',
  gold: 'bg-gold',
  ok: 'bg-ok',
  err: 'bg-err',
}

interface BarProps {
  /** 0-1. */
  value: number
  tone?: Tone
  /** Track height in px; the design's default bar is 10. */
  height?: number
  className?: string
  label?: string
}

/** Progress bar: h10 track on --line, fill transitions over 420ms. */
export function ProgressBar({
  value,
  tone = 'accent',
  height = 10,
  className = '',
  label,
}: BarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div
      className={`overflow-hidden rounded-full bg-line ${className}`}
      style={{ height }}
      role={label ? 'progressbar' : undefined}
      aria-label={label}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-[420ms] ease-standard ${FILL[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

interface RingProps {
  /** 0-1. */
  value: number
  size?: number
  stroke?: number
  tone?: Tone
  /** Sweep the arc in on mount. Neutralised under reduced motion by index.css. */
  animate?: boolean
  className?: string
  label?: string
  children?: ReactNode
}

/**
 * Progress ring. Geometry comes from ringDash() in lib/rewards.ts so the arc
 * arithmetic has one tested home; this component only draws it. Serves the
 * design's 96px component ring, the 150px results ring and the Progress hero.
 */
export function ProgressRing({
  value,
  size = 96,
  stroke = 9,
  tone = 'accent',
  animate = true,
  className = '',
  label,
  children,
}: RingProps) {
  const c = size / 2
  const r = c - stroke / 2 - 2
  const { dasharray, dashoffset } = ringDash(value, r)
  const style = { '--ring-dasharray': dasharray } as CSSProperties

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
      >
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--color-line)" strokeWidth={stroke} />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={STROKE[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={dasharray}
          strokeDashoffset={dashoffset}
          transform={`rotate(-90 ${c} ${c})`}
          className={animate ? 'animate-ring-sweep' : undefined}
          style={style}
        />
      </svg>
      {children ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
      ) : null}
    </div>
  )
}
