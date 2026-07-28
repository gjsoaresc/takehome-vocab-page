import type { Pos, WordStatus } from '@vocab/shared'
import { Icon, type IconName } from '../ui/Icon'

export type PosFilter = Pos | 'all'
export type StatusFilter = WordStatus | 'all'

const POS: Array<{ value: Pos; label: string }> = [
  { value: 'v', label: 'verb' },
  { value: 'n', label: 'noun' },
  { value: 'adj', label: 'adj' },
  { value: 'adv', label: 'adv' },
]

const STATUS: Array<{ value: WordStatus; label: string; icon: IconName }> = [
  { value: 'new', label: 'New', icon: 'spark' },
  { value: 'learning', label: 'Learning', icon: 'timer' },
  { value: 'mastered', label: 'Mastered', icon: 'check' },
]

function Chip({
  label,
  active,
  count,
  icon,
  onClick,
}: {
  label: string
  active: boolean
  count?: number
  icon?: IconName
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] leading-none font-semibold transition-colors duration-[160ms] ${
        active
          ? 'border-accent bg-accent text-on-accent'
          : 'border-line bg-card text-muted active:border-accent'
      }`}
    >
      {icon ? <Icon name={icon} size={12} strokeWidth={2.6} /> : null}
      {label}
      {count !== undefined ? <span className="tabular opacity-70">{count}</span> : null}
    </button>
  )
}

/**
 * Part-of-speech and status filters as chips, scrolling inside their own
 * container so the page itself never moves sideways.
 */
export function FilterChips({
  pos,
  status,
  counts,
  total,
  onPos,
  onStatus,
  onReset,
}: {
  pos: PosFilter
  status: StatusFilter
  counts: Record<WordStatus, number>
  total: number
  onPos: (next: PosFilter) => void
  onStatus: (next: StatusFilter) => void
  onReset: () => void
}) {
  return (
    <div
      role="group"
      aria-label="Filters"
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <Chip label="All" active={pos === 'all' && status === 'all'} count={total} onClick={onReset} />
      {POS.map((p) => (
        <Chip
          key={p.value}
          label={p.label}
          active={pos === p.value}
          onClick={() => onPos(pos === p.value ? 'all' : p.value)}
        />
      ))}
      {STATUS.map((s) => (
        <Chip
          key={s.value}
          label={s.label}
          icon={s.icon}
          count={counts[s.value]}
          active={status === s.value}
          onClick={() => onStatus(status === s.value ? 'all' : s.value)}
        />
      ))}
    </div>
  )
}
