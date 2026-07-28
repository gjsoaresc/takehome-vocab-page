import type { WordDto, WordStatus } from '@vocab/shared'
import { SyncChip } from '../States'
import { Icon, type IconName } from '../ui/Icon'
import { RatingBar } from './RatingBar'

/** Status is icon + label + colour. Never colour alone. */
const STATUS: Record<WordStatus, { label: string; icon: IconName; className: string }> = {
  new: { label: 'New', icon: 'spark', className: 'bg-line text-muted' },
  learning: { label: 'Learning', icon: 'timer', className: 'bg-warn-soft text-warn' },
  mastered: { label: 'Mastered', icon: 'check', className: 'bg-ok-soft text-ok' },
}

const POS_LABEL: Record<string, string> = { v: 'verb', n: 'noun', adj: 'adjective', adv: 'adverb' }

export interface RowFeedback {
  /** "next review in 9 days", straight from the server's SM-2 result. */
  interval: string
  queued: boolean
}

interface WordRowProps {
  word: WordDto
  rowIndex: number
  open: boolean
  revealed: boolean
  focused: boolean
  feedback?: RowFeedback
  onToggle: () => void
  onReveal: () => void
  onRate: (rating: number) => void
}

function dueText(word: WordDto, feedback?: RowFeedback): string {
  if (feedback) return `Just rated - ${feedback.interval}`
  if (word.status === 'new') return 'Not seen yet'
  if (!word.due_at) return 'Due today'
  const days = Math.round((new Date(word.due_at).getTime() - Date.now()) / 86_400_000)
  if (days <= 0) return 'Due today'
  return `Review in ${days} day${days === 1 ? '' : 's'}`
}

/**
 * One virtualised row. Collapsed it is the headword, its parts of speech and
 * when it is next due. Open, the meaning stays face-down behind a Reveal
 * affordance - the deliberate beat the design asks for, and the moment the
 * `revealed` event is written.
 */
export function WordRow({
  word,
  rowIndex,
  open,
  revealed,
  focused,
  feedback,
  onToggle,
  onReveal,
  onRate,
}: WordRowProps) {
  const badge = STATUS[word.status]
  const parts = [...new Set(word.senses.map((s) => POS_LABEL[s.pos] ?? s.pos))].join(', ')

  return (
    <div
      className={`overflow-hidden rounded-[18px] border bg-card transition-[border-color] duration-[160ms] ${
        open ? 'border-accent' : word.status === 'mastered' ? 'border-ok/30' : 'border-line'
      }`}
    >
      <button
        type="button"
        data-word-row={rowIndex}
        tabIndex={focused ? 0 : -1}
        onClick={onToggle}
        aria-expanded={open}
        className="tap flex w-full items-center gap-2 px-3.5 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-[16.5px] leading-[21px] font-semibold text-ink">
              {word.headword}
            </span>
            <span className="shrink-0 text-[11px] text-muted italic">{parts}</span>
          </span>
          <span className="block text-[11.5px] leading-4 text-muted">{dueText(word, feedback)}</span>
        </span>
        {feedback?.queued ? (
          <SyncChip state="queued" />
        ) : (
          <span
            className={`inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] leading-none font-semibold ${badge.className}`}
          >
            <Icon name={badge.icon} size={12} strokeWidth={2.6} />
            {badge.label}
          </span>
        )}
        <Icon
          name="chevronRight"
          size={16}
          strokeWidth={2.2}
          className={`shrink-0 text-muted transition-transform duration-[160ms] ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {open ? (
        <div className="animate-rise flex flex-col gap-3 px-3.5 pb-3.5">
          {revealed ? (
            <div className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-paper p-3">
              {word.senses.map((sense) => (
                <div key={sense.senseNo}>
                  <p className="text-sm leading-[19px] text-ink">
                    <span className="font-semibold text-muted">({sense.pos}.)</span>{' '}
                    {sense.definition}
                  </p>
                  {sense.example ? (
                    <p className="mt-1 text-[12.5px] leading-[17px] text-muted italic">
                      {sense.example}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onReveal()
              }}
              className="tap flex w-full items-center justify-center gap-2 rounded-[14px] border border-dashed border-line bg-paper text-sm font-semibold text-accent-strong transition-transform duration-[90ms] active:scale-[0.985]"
            >
              <Icon name="book" size={16} />
              Reveal meaning
            </button>
          )}
          <RatingBar onRate={onRate} disabled={!revealed} />
        </div>
      ) : null}
    </div>
  )
}
