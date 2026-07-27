import type { MatchingPairDto } from '@vocab/shared'
import { useMemo, useRef, useState } from 'react'

interface MatchBoardProps {
  pairs: MatchingPairDto[]
  onAttempt: (wordId: number, correct: boolean) => void
  onComplete: (attempts: number) => void
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
export function MatchBoard({ pairs, onAttempt, onComplete }: MatchBoardProps) {
  const words = useMemo(() => shuffled(pairs), [pairs])
  const defs = useMemo(() => shuffled(pairs), [pairs])
  const [locked, setLocked] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<number | null>(null)
  const [wrongDef, setWrongDef] = useState<number | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const attempts = useRef(0)

  function attemptPair(wordId: number, defWordId: number) {
    if (locked.has(wordId) || locked.has(defWordId)) return
    attempts.current += 1
    const correct = wordId === defWordId
    onAttempt(wordId, correct)
    setSelected(null)
    if (correct) {
      const next = new Set(locked).add(wordId)
      setLocked(next)
      if (next.size === pairs.length) onComplete(attempts.current)
    } else {
      setWrongDef(defWordId)
      setTimeout(() => setWrongDef(null), 650)
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

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="flex flex-col gap-2" role="group" aria-label="Words">
        {words.map((pair) => {
          const isLocked = locked.has(pair.word_id)
          const isSelected = selected === pair.word_id
          const isDragged = drag?.wordId === pair.word_id && drag.dragging
          return (
            <button
              key={pair.word_id}
              type="button"
              disabled={isLocked}
              aria-pressed={isSelected}
              onPointerDown={(e) => onPointerDown(e, pair.word_id)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              style={
                isDragged
                  ? {
                      transform: `translate(${drag.dx}px, ${drag.dy}px)`,
                      pointerEvents: 'none',
                      zIndex: 20,
                    }
                  : undefined
              }
              className={`tap relative touch-none select-none rounded-xl border px-3 py-3 text-left font-semibold ${
                isLocked
                  ? 'border-ok bg-ok-soft text-ok opacity-70'
                  : isSelected
                    ? 'border-accent bg-accent-soft'
                    : 'border-line bg-card active:border-accent'
              }`}
            >
              {isLocked ? '✓ ' : ''}
              {pair.headword}
            </button>
          )
        })}
      </div>
      <div className="flex flex-col gap-2" role="group" aria-label="Definitions">
        {defs.map((pair) => {
          const isLocked = locked.has(pair.word_id)
          const isWrong = wrongDef === pair.word_id
          return (
            <button
              key={pair.word_id}
              type="button"
              disabled={isLocked || selected === null}
              data-def-word={pair.word_id}
              onClick={() => selected !== null && attemptPair(selected, pair.word_id)}
              className={`tap rounded-xl border px-3 py-3 text-left text-sm ${
                isLocked
                  ? 'border-ok bg-ok-soft text-ok opacity-70'
                  : isWrong
                    ? 'animate-shake border-err bg-err-soft'
                    : selected !== null
                      ? 'border-line bg-card active:border-accent'
                      : 'border-line bg-card'
              }`}
            >
              {isLocked ? '✓ ' : isWrong ? '✗ ' : ''}
              {pair.definition}
            </button>
          )
        })}
      </div>
      <p aria-live="polite" className="sr-only">
        {wrongDef !== null
          ? 'Not a match'
          : locked.size > 0
            ? `${locked.size} of ${pairs.length} matched`
            : ''}
      </p>
    </div>
  )
}
