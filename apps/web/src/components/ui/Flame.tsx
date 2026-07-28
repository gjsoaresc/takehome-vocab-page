import type { FlameTier } from '../../lib/rewards'

const PATH =
  'M12 2c2.6 3.4 1.1 5.2 2.9 7.2 1.7 1.9 3.1 3 3.1 5.3a6 6 0 11-12 0c0-2.6 1.7-3.9 2.9-5.9.6 1.2 1.2 1.6 1.7 1.2C11.3 8.4 10.6 5.3 12 2z'

/**
 * Streak flame. Tiers escalate at 3 / 7 / 30 / 100 days, and a live streak with
 * nothing done today reads at-risk with a dashed outline - never colour alone,
 * so the label beside it always says which state this is.
 */
const TIERS: Record<
  FlameTier,
  { fill: string; stroke: string; dash?: string; flicker: boolean; label: string }
> = {
  none: { fill: 'none', stroke: 'var(--color-line)', flicker: false, label: 'No streak' },
  spark: { fill: 'none', stroke: 'var(--color-muted)', flicker: false, label: 'Day 1' },
  day3: {
    fill: 'var(--color-warn-soft)',
    stroke: 'var(--color-flame)',
    flicker: false,
    label: 'Day 3',
  },
  day7: {
    fill: 'var(--color-flame-soft)',
    stroke: 'var(--color-flame)',
    flicker: true,
    label: 'Day 7',
  },
  day30: {
    fill: 'var(--color-flame)',
    stroke: 'var(--color-gold)',
    flicker: true,
    label: 'Day 30',
  },
  day100: {
    fill: 'var(--color-gold)',
    stroke: 'var(--color-gold)',
    flicker: true,
    label: 'Day 100',
  },
  atRisk: {
    fill: 'none',
    stroke: 'var(--color-warn)',
    dash: '3 3',
    flicker: false,
    label: 'At risk',
  },
}

export function Flame({
  tier,
  size = 30,
  className = '',
}: {
  tier: FlameTier
  size?: number
  className?: string
}) {
  const t = TIERS[tier]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`${t.flicker ? 'animate-flicker' : ''} ${className}`}
    >
      <path d={PATH} fill={t.fill} stroke={t.stroke} strokeWidth={1.5} strokeDasharray={t.dash} />
    </svg>
  )
}

export const flameLabel = (tier: FlameTier) => TIERS[tier].label
