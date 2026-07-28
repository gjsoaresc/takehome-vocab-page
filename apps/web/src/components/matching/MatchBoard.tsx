import type { MatchingPairDto } from '@vocab/shared'
import { useMemo, useRef, useState } from 'react'
import { Icon } from '../ui/Icon'

interface MatchBoardProps {
  pairs: MatchingPairDto[]
  onAttempt: (wordId: number, correct: boolean) => void
  onComplete: (attempts: number) => void
  /** Attempts so far, so the header can show the move counter. */
  onMove?: (attempts: number) => void
}

interface DragState {
  wordId: number
  startX: number
  startY: number
  dx: number
  dy: number
  dragging: boolean
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

/**
 * Word/definition pairing board. Both interactions share attemptPair():
 *  - tap: select a word, then tap a definition
 *  - drag: pointer events (mouse AND touch) drop a word onto a definition
 */
export function MatchBoard({ pairs, onAttempt, onComplete, onMove }: MatchBoardProps) {
  const words = useMemo(() => shuffled(pairs), [pairs])
  const defs = useMemo(() => shuffled(pairs), [pairs])
  const [locked, setLocked] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<number | null>(null)
  const [wrong, setWrong] = useState<{ word: number; def: number } | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const attempts = useRef(0)

  function attemptPair(wordId: number, defWordId: number) {
    if (locked.has(wordId) || locked.has(defWordId)) return
    attempts.current += 1
    onMove?.(attempts.current)
    const correct = wordId === defWordId
    onAttempt(wordId, correct)
    setSelected(null)
    if (correct) {
      const next = new Set(locked).add(wordId)
      setLocked(next)
      if (next.size === pairs.length) onComplete(attempts.current)
    } else {
      setWrong({ word: wordId, def: defWordId })
      setTimeout(() => setWrong(null), 1100)
    }
  }

  function onPointerDown(e: React.PointerEvent, wordId: number) {
    if (locked.has(wordId)) return
    try {
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // Synthetic pointers (tests) have no active pointer to capture; the
      // drag still works through the React handlers below.
    }
    setDrag({ wordId, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, dragging: false })
  }

  function onPointerMove(e: React.PointerEvent) {
    setDrag((d) => {
      if (!d) return d
      const dx = e.clientX - d.startX
      const dy = e.clientY - d.startY
      const dragging = d.dragging || Math.hypot(dx, dy) > 8
      return { ...d, dx, dy, dragging }
    })
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag
    setDrag(null)
    if (!d) return
    if (!d.dragging) {
      // A plain tap: select the word (tap path).
      setSelected((cur) => (cur === d.wordId ? null : d.wordId))
      return
    }
    // Drop: the dragged tile has pointer-events:none, so elementFromPoint
    // resolves whatever is underneath the finger/cursor.
    const target = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>('[data-def-word]')
    if (target) attemptPair(d.wordId, Number(target.dataset.defWord))
  }

  const remaining = pairs.length - locked.size
  const dragging = drag?.dragging ? pairs.find((p) => p.word_id === drag.wordId) : null

  return (
    <div className="relative">
      <div className="flex gap-1 pb-3">
        {pairs.map((p, i) => (
          <div
            key={p.word_id}
            className={`h-[7px] flex-1 rounded-[4px] transition-colors duration-[240ms] ${
              i < locked.size ? 'bg-ok' : 'bg-line'
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-[146px_1fr] items-start gap-2.5">
        <div className="flex flex-col gap-2" role="group" aria-label="Words">
          <span className="pl-0.5 text-[10px] leading-none font-semibold tracking-[0.08em] text-muted uppercase">
            Word
          </span>
          {words.map((pair) => {
            const isLocked = locked.has(pair.word_id)
            const isSelected = selected === pair.word_id
            const isDragged = drag?.wordId === pair.word_id && drag.dragging
            const isWrong = wrong?.word === pair.word_id
            if (isLocked) return null
            return (
              <button
                key={pair.word_id}
                type="button"
                lang="en"
                aria-pressed={isSelected}
                onPointerDown={(e) => onPointerDown(e, pair.word_id)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                style={isDragged ? { opacity: 0.35 } : undefined}
                className={`flex min-h-14 touch-none items-center gap-1.5 rounded-lg border-[1.5px] px-2.5 py-2.5 text-left transition-[background-color,border-color,transform] duration-[160ms] select-none ${
                  isWrong
                    ? 'animate-nudge border-err bg-err-soft'
                    : isSelected
                      ? 'scale-[1.02] border-accent bg-accent-soft shadow-[0_4px_14px_-6px_var(--color-accent)]'
                      : isDragged
                        ? 'border-line border-dashed bg-card'
                        : 'border-line bg-card'
                }`}
              >
                <span
                  className={`min-w-0 flex-1 text-[15px] leading-5 font-semibold break-words hyphens-auto ${
                    isWrong ? 'text-err' : isSelected ? 'text-accent-strong' : 'text-ink'
                  }`}
                >
                  {pair.headword}
                </span>
                {isWrong ? (
                  <Icon name="cross" size={15} strokeWidth={3} className="flex-none text-err" />
                ) : (
                  <span aria-hidden className="flex-none text-line">
                    <svg width="10" height="16" viewBox="0 0 12 16" fill="currentColor">
                      <circle cx="3" cy="4" r="1.4" />
                      <circle cx="9" cy="4" r="1.4" />
                      <circle cx="3" cy="8" r="1.4" />
                      <circle cx="9" cy="8" r="1.4" />
                      <circle cx="3" cy="12" r="1.4" />
                      <circle cx="9" cy="12" r="1.4" />
                    </svg>
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex min-w-0 flex-col gap-2" role="group" aria-label="Definitions">
          <span className="pl-0.5 text-[10px] leading-none font-semibold tracking-[0.08em] text-muted uppercase">
            Meaning
          </span>
          {defs.map((pair) => {
            const isLocked = locked.has(pair.word_id)
            const isWrong = wrong?.def === pair.word_id
            const isTarget = selected !== null || Boolean(drag?.dragging)
            const long = pair.definition.length > 68
            const open = expanded === pair.word_id
            if (isLocked) return null
            return (
              <div
                key={pair.word_id}
                data-def-word={pair.word_id}
                role="button"
                tabIndex={0}
                onClick={() => selected !== null && attemptPair(selected, pair.word_id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && selected !== null) attemptPair(selected, pair.word_id)
                }}
                className={`flex min-h-14 items-start gap-2 rounded-lg border-[1.5px] px-3 py-3 transition-[background-color,border-color] duration-[160ms] ${
                  isWrong
                    ? 'animate-nudge border-err bg-err-soft'
                    : isTarget
                      ? 'border-accent/35 bg-card'
                      : 'border-line bg-card'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p
                    className={`overflow-hidden text-[13px] leading-[18px] ${isWrong ? 'text-err' : 'text-ink'}`}
                    style={{ maxHeight: open || !long ? 'none' : 54 }}
                  >
                    {pair.definition}
                  </p>
                  {long ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpanded(open ? null : pair.word_id)
                      }}
                      className="mt-1 min-h-7 text-[11.5px] leading-none font-semibold text-accent-strong"
                    >
                      {open ? 'Show less' : 'Show all'}
                    </button>
                  ) : null}
                </div>
                {isWrong ? (
                  <Icon name="cross" size={16} strokeWidth={3} className="mt-px flex-none text-err" />
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {locked.size > 0 ? (
        <div className="mt-4">
          <span className="text-[10px] leading-none font-semibold tracking-[0.08em] text-muted uppercase">
            Locked in
          </span>
          <div className="mt-2 flex flex-col gap-1.5">
            {pairs
              .filter((p) => locked.has(p.word_id))
              .map((p) => (
                <div
                  key={p.word_id}
                  className="animate-settle flex items-center gap-2.5 rounded-[14px] border border-ok/30 bg-ok-soft px-3 py-2.5"
                >
                  <Icon name="check" size={16} strokeWidth={3} className="flex-none text-ok" />
                  <span className="flex-none text-[13.5px] leading-[18px] font-bold text-ink">
                    {p.headword}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] leading-[17px] text-muted">
                    {p.definition}
                  </span>
                  <span className="flex-none text-[10.5px] leading-none font-bold tracking-[0.04em] text-ok uppercase">
                    Matched
                  </span>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {dragging ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-30 flex min-h-13 min-w-30 items-center rounded-lg border-[1.5px] border-accent bg-card px-3 py-2.5 shadow-e3"
          style={{ left: 0, top: 0, transform: `translate(${drag!.startX + drag!.dx - 60}px, ${drag!.startY + drag!.dy - 26}px)` }}
        >
          <span className="text-[15.5px] leading-5 font-semibold text-accent-strong">
            {dragging.headword}
          </span>
        </div>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {wrong
          ? 'Not a match. That meaning belongs to another word.'
          : locked.size > 0
            ? `${locked.size} of ${pairs.length} matched, ${remaining} left`
            : ''}
      </p>
    </div>
  )
}
