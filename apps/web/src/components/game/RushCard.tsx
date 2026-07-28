import type { GameCardDto } from '@vocab/shared'
import { useRef, useState } from 'react'
import { Icon } from '../ui/Icon'

/** Design's commit threshold: 92px of travel, or a flick past 0.6px/ms. */
const COMMIT_PX = 92
const FLICK_VELOCITY = 0.6
/** Per-letter deal-in offset. The longest headword still lands under ~320ms. */
const LETTER_STAGGER_MS = 18

/**
 * Swipeable judgment card: right = "these match", left = "they don't".
 *
 * The two intent labels fade in with the drag so the commit threshold is
 * legible before release, and each is a word plus an icon - the whole game is
 * playable without ever reading the colour, and without gesturing at all,
 * because the two buttons underneath fire the identical path.
 */
export function RushCard({
  card,
  onJudge,
  shake,
}: {
  card: GameCardDto
  onJudge: (saysMatch: boolean) => void
  shake: boolean
}) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; t: number } | null>(null)

  function onPointerDown(e: React.PointerEvent) {
    start.current = { x: e.clientX, t: performance.now() }
    setDragging(true)
    try {
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // Synthetic pointers (tests) cannot be captured; movement still tracks.
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!start.current) return
    setDx(e.clientX - start.current.x)
  }

  function onPointerUp() {
    const from = start.current
    const finalDx = dx
    start.current = null
    setDragging(false)
    setDx(0)
    if (!from) return
    const velocity = Math.abs(finalDx) / Math.max(1, performance.now() - from.t)
    if (Math.abs(finalDx) > COMMIT_PX || (velocity > FLICK_VELOCITY && Math.abs(finalDx) > 24)) {
      onJudge(finalDx > 0)
    }
  }

  const yes = Math.max(0, Math.min(1, dx / COMMIT_PX))
  const no = Math.max(0, Math.min(1, -dx / COMMIT_PX))
  const border = dx > 40 ? 'border-ok' : dx < -40 ? 'border-err' : 'border-line'
  const longWord = card.headword.length > 11

  return (
    <div className="relative h-[266px]">
      {/* Two resting cards behind the live one, so the deck reads as a stack. */}
      <div className="absolute inset-x-3.5 top-5 h-[250px] scale-[0.92] rounded-2xl border border-line bg-card opacity-45" />
      <div className="absolute inset-x-2 top-3.5 h-[256px] scale-[0.96] rounded-2xl border border-line bg-card opacity-70" />

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          transform: `translateX(${dx}px) rotate(${dx / 16}deg)`,
          transition: dragging ? 'none' : 'transform 240ms cubic-bezier(.34,1.56,.64,1)',
        }}
        className={`absolute inset-x-0 top-0 flex h-[266px] cursor-grab touch-none flex-col justify-center rounded-2xl border-[1.5px] bg-card p-5 shadow-e3 select-none ${border} ${
          shake && !dragging ? 'animate-nudge' : ''
        }`}
      >
        <p className="text-[10.5px] leading-none font-semibold tracking-[0.08em] text-muted uppercase">
          Do these match?
        </p>
        {/* Letters deal in one at a time, filling the dead beat between cards.
            The word itself is announced once from the sr-only copy - split into
            per-letter spans, some screen readers would spell it out instead.
            RushCard is keyed by card index in game.tsx, so the remount replays
            this on every new word with no key of its own. */}
        <p
          className={`mt-2 font-bold tracking-[-0.025em] text-ink ${
            longWord ? 'text-[30px] leading-[34px]' : 'text-[38px] leading-[42px]'
          }`}
        >
          <span className="sr-only">{card.headword}</span>
          <span aria-hidden>
            {[...card.headword].map((letter, i) => (
              <span
                key={i}
                className="animate-letters-in inline-block"
                style={{ animationDelay: `${i * LETTER_STAGGER_MS}ms` }}
              >
                {letter === ' ' ? '\u00A0' : letter}
              </span>
            ))}
          </span>
        </p>
        <div className="mt-3 rounded-lg border border-line bg-paper px-3.5 py-3 text-[15px] leading-[21px] text-ink">
          {card.definition}
        </div>

        <span
          style={{ opacity: no }}
          className="absolute top-4 left-4 inline-flex h-[34px] -rotate-[8deg] items-center gap-1.5 rounded-[12px] bg-err px-3 text-on-err transition-opacity duration-[120ms]"
        >
          <Icon name="cross" size={15} strokeWidth={3} />
          <span className="text-[12.5px] leading-none font-extrabold tracking-[0.04em] uppercase">
            No match
          </span>
        </span>
        <span
          style={{ opacity: yes }}
          className="absolute top-4 right-4 inline-flex h-[34px] rotate-[8deg] items-center gap-1.5 rounded-[12px] bg-ok px-3 text-on-ok transition-opacity duration-[120ms]"
        >
          <Icon name="check" size={15} strokeWidth={3} />
          <span className="text-[12.5px] leading-none font-extrabold tracking-[0.04em] uppercase">
            Match
          </span>
        </span>
      </div>
    </div>
  )
}
