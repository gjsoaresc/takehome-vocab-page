import type { WordDto, WordStatus } from '@vocab/shared'
import { RatingBar } from './RatingBar'

const STATUS_BADGE: Record<WordStatus, { label: string; className: string; mark: string }> = {
  new: { label: 'New', className: 'bg-paper text-muted', mark: '○' },
  learning: { label: 'Learning', className: 'bg-accent-soft text-accent-strong', mark: '◔' },
  mastered: { label: 'Mastered', className: 'bg-ok-soft text-ok', mark: '✓' },
}

const POS_LABEL: Record<string, string> = { v: 'verb', n: 'noun', adj: 'adjective', adv: 'adverb' }

interface WordRowProps {
  word: WordDto
  open: boolean
  focused: boolean
  onToggle: () => void
  onRate: (rating: number) => void
  rowIndex: number
}

/** One virtualized row: collapsed = headword only; open = revealed senses + rating. */
export function WordRow({ word, open, focused, onToggle, onRate, rowIndex }: WordRowProps) {
  const badge = STATUS_BADGE[word.status]
  return (
    <div className="border-b border-line">
      <button
        type="button"
        data-word-row={rowIndex}
        tabIndex={focused ? 0 : -1}
        onClick={onToggle}
        aria-expanded={open}
        className="tap flex w-full items-center justify-between gap-2 px-1 py-3 text-left"
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-lg font-semibold">{word.headword}</span>
          <span className="shrink-0 text-xs text-muted">
            {[...new Set(word.senses.map((s) => POS_LABEL[s.pos] ?? s.pos))].join(', ')}
          </span>
        </span>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}
        >
          {badge.mark} {badge.label}
        </span>
      </button>
      {open ? (
        <div className="flex flex-col gap-3 px-1 pb-4">
          {word.senses.map((sense) => (
            <div key={sense.senseNo}>
              <p className="text-sm">
                <span className="font-semibold text-muted">({sense.pos}.)</span>{' '}
                {sense.definition}
              </p>
              {sense.example ? (
                <p className="mt-1 text-sm italic text-muted">{sense.example}</p>
              ) : null}
            </div>
          ))}
          <RatingBar onRate={onRate} />
        </div>
      ) : null}
    </div>
  )
}
