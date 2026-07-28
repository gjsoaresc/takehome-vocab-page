import { formatProgress, type Badge } from '../../lib/rewards'
import { Icon, type IconName } from '../ui/Icon'
import { RewardSheet } from './RewardSheet'

/** Family -> glyph, matching the icon direction in the design's badge table. */
export const BADGE_ICON: Record<string, IconName> = {
  'first-light': 'spark',
  'wide-net': 'grid',
  'full-sweep': 'circleCheck',
  century: 'bars',
  'half-book': 'book',
  complete: 'star',
  'three-days': 'flame',
  'week-runner': 'flame',
  'month-straight': 'flame',
  'hundred-days': 'flame',
  sharpshooter: 'target',
  'both-directions': 'swap',
  'rush-hour': 'timer',
}

const FAMILY_LABEL: Record<Badge['family'], string> = {
  breadth: 'Breadth family',
  depth: 'Depth family',
  consistency: 'Consistency family',
  precision: 'Precision family',
  speed: 'Speed family',
}

/**
 * Badge unlock, large tier. The condition is shown in the same field language
 * Progress uses, so a badge is never mysterious, and the next one in the family
 * is named with its own condition - a locked badge is a stated goal, not a tease.
 */
export function BadgeSheet({
  badge,
  familyEarned,
  familyTotal,
  next,
  onDismiss,
}: {
  badge: Badge
  familyEarned: number
  familyTotal: number
  next: Badge | null
  onDismiss: () => void
}) {
  return (
    <RewardSheet onDismiss={onDismiss} labelledBy="badge-title">
      <span className="inline-flex h-[26px] items-center rounded-full bg-gold-soft px-3 text-[11px] leading-none font-bold tracking-[0.08em] text-gold uppercase">
        Badge unlocked
      </span>

      <span className="animate-pop-badge mt-4 grid h-[120px] w-[120px] place-items-center rounded-[38px] border-[1.5px] border-gold/35 bg-gold-soft text-gold">
        <Icon name={BADGE_ICON[badge.id] ?? 'star'} size={58} strokeWidth={1.7} />
      </span>

      <h2 id="badge-title" className="mt-4 text-xl font-bold tracking-[-0.02em] text-ink">
        {badge.name}
      </h2>
      <p className="mt-1 font-mono text-xs text-muted">{badge.condition}</p>

      <div className="mt-3.5 flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2.5">
        <span className="text-xs font-semibold text-muted">{FAMILY_LABEL[badge.family]}</span>
        <span className="tabular text-xs font-bold text-gold">
          {familyEarned} of {familyTotal}
        </span>
      </div>

      {next ? (
        <div className="mt-3.5 flex w-full items-center gap-2.5 rounded-lg border border-dashed border-line bg-paper px-3 py-2.5">
          <Icon name="lock" size={16} className="flex-none text-muted" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-ink">Next: {next.name}</span>
            <span className="tabular block font-mono text-[10.5px] text-muted">
              {next.condition} - {formatProgress(next.progress)}
            </span>
          </span>
        </div>
      ) : null}
    </RewardSheet>
  )
}
