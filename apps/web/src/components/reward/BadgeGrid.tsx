import { formatProgress, type Badge } from '../../lib/rewards'
import { Icon } from '../ui/Icon'
import { ProgressBar } from '../ui/Progress'
import { BADGE_ICON } from './BadgeSheet'

/**
 * The full badge case. Earned badges get a family tint, a solid border and a
 * full-colour glyph; locked ones get paper, a dashed border and - crucially -
 * their exact condition plus how far along it is. Never a silhouette or a "?":
 * a locked badge is a stated goal, not a tease.
 */
export function BadgeGrid({ badges }: { badges: Badge[] }) {
  const earned = badges.filter((b) => b.earned)
  const locked = badges.filter((b) => !b.earned)

  return (
    <section aria-label="Badges">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] leading-none font-semibold tracking-[0.08em] text-muted uppercase">
          Badges
        </span>
        <span className="tabular text-xs font-semibold text-accent-strong">
          {earned.length} of {badges.length}
        </span>
      </div>

      {earned.length > 0 ? (
        <div className="mt-3.5 grid grid-cols-4 gap-2.5">
          {earned.map((b) => (
            <div key={b.id} className="flex flex-col items-center gap-1.5">
              <span
                className="grid aspect-square w-full place-items-center rounded-[18px] border border-gold/30 bg-gold-soft text-gold"
                title={b.condition}
              >
                <Icon name={BADGE_ICON[b.id] ?? 'star'} size={26} />
              </span>
              <span className="text-center text-[10px] leading-[13px] font-semibold text-ink">
                {b.name}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3.5 flex flex-col gap-2">
        {locked.map((b) => (
          <div
            key={b.id}
            className="flex items-center gap-2.5 rounded-lg border border-dashed border-line bg-paper px-3 py-2.5"
          >
            <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[12px] border border-line bg-card text-muted">
              <Icon name="lock" size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] leading-[17px] font-semibold text-ink">{b.name}</p>
              <p className="font-mono text-[10.5px] leading-[14px] text-muted">{b.condition}</p>
              <ProgressBar
                value={b.progress.current / b.progress.target}
                tone="gold"
                height={5}
                className="mt-1.5"
              />
            </div>
            <span className="tabular flex-none text-[11.5px] font-bold text-gold">
              {formatProgress(b.progress)}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
