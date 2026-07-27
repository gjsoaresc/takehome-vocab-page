import type { GameCardDto } from '@vocab/shared'
import { useRef, useState } from 'react'

interface RushCardProps {
  card: GameCardDto
  onJudge: (saysMatch: boolean) => void
}

const COMMIT_PX = 80

/** Swipeable judgment card: right = "these match", left = "they don't". */
export function RushCard({ card, onJudge }: RushCardProps) {
  const [dx, setDx] = useState(0)
  const start = useRef<number | null>(null)

  function onPointerDown(e: React.PointerEvent) {
    start.current = e.clientX
    try {
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // Synthetic pointers (tests) cannot be captured; movement still tracks.
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (start.current === null) return
    setDx(e.clientX - start.current)
  }

  function onPointerUp() {
    if (start.current === null) return
    const finalDx = dx
    start.current = null
    setDx(0)
    if (Math.abs(finalDx) > COMMIT_PX) onJudge(finalDx > 0)
  }

  const leaning = Math.abs(dx) > COMMIT_PX ? (dx > 0 ? 'match' : 'no') : null

  return (
    <div className="relative">
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          transform: `translateX(${dx}px) rotate(${dx / 18}deg)`,
          transition: dx === 0 ? 'transform 150ms ease-out' : 'none',
        }}
        className={`touch-none select-none rounded-2xl border-2 bg-card p-6 shadow-sm ${
          leaning === 'match'
            ? 'border-ok'
            : leaning === 'no'
              ? 'border-err'
              : 'border-line'
        }`}
      >
        <p className="text-center text-3xl font-bold">{card.headword}</p>
        <p className="mt-4 min-h-16 text-center text-base">{card.definition}</p>
        <p className="mt-4 text-center text-xs font-semibold text-muted">
          Do they match? Swipe right for yes, left for no
        </p>
      </div>
      {leaning ? (
        <span
          className={`absolute left-1/2 top-2 -translate-x-1/2 rounded-full px-3 py-1 text-sm font-bold ${
            leaning === 'match' ? 'bg-ok-soft text-ok' : 'bg-err-soft text-err'
          }`}
        >
          {leaning === 'match' ? 'Match' : 'No match'}
        </span>
      ) : null}
    </div>
  )
}
