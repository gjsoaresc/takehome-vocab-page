import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePrefersReducedMotion } from '../../lib/motion'
import { CARD } from '../ui/Card'
import { Chip } from '../ui/Chip'
import { Icon, type IconName } from '../ui/Icon'
import { Pill } from '../ui/Chip'

export type ModeTone = 'accent' | 'xp' | 'gold' | 'flame'

/** Long enough that a tap never flashes the peek, short enough to feel instant. */
const HOLD_MS = 180

const TONE_TEXT: Record<ModeTone, string> = {
  accent: 'text-accent',
  xp: 'text-xp',
  gold: 'text-gold',
  flame: 'text-flame',
}

const TONE_TILE: Record<ModeTone, string> = {
  accent: 'bg-accent-soft text-accent',
  xp: 'bg-xp-soft text-xp',
  gold: 'bg-gold-soft text-gold',
  flame: 'bg-flame-soft text-flame',
}

export interface Mode {
  to: string
  name: string
  sub: string
  icon: IconName
  tone: ModeTone
  /** The live number that gives a reason to tap. */
  stat: string
  /** Only on the suggested card: accuracy chip plus a sentence. */
  detail?: { chip: string; chipTone: 'ok' | 'warn' | 'accent'; note: string }
  /** Only on the suggested card: the real reason this mode was chosen. */
  why?: string
  /**
   * What a hold reveals. Two or three lines of the mode's own record - there is
   * no sparkline, because StatsDto carries no per-mode time series.
   */
  peek?: { headline: string; lines: string[] }
  /** Zero state: what has to happen before this mode is worth opening. */
  gate?: string
}

/**
 * Press-and-hold to peek, tap to launch.
 *
 * The peek only opens after HOLD_MS so a normal tap never flashes it, and the
 * click is suppressed only when a peek actually opened - otherwise holding a
 * card would navigate the moment you let go.
 */
function useHoldToPeek(enabled: boolean) {
  const [peeking, setPeeking] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const opened = useRef(false)

  useEffect(() => () => clearTimeout(timer.current), [])

  if (!enabled) return { peeking: false, handlers: {} }

  return {
    peeking,
    handlers: {
      onPointerDown: () => {
        // Reset here rather than on release: a pointer that leaves the card, or
        // a drag that becomes a scroll, never fires the click that would clear it.
        opened.current = false
        clearTimeout(timer.current)
        timer.current = setTimeout(() => {
          opened.current = true
          setPeeking(true)
        }, HOLD_MS)
      },
      onPointerUp: () => {
        clearTimeout(timer.current)
        setPeeking(false)
      },
      onPointerLeave: () => {
        clearTimeout(timer.current)
        setPeeking(false)
      },
      onPointerCancel: () => {
        clearTimeout(timer.current)
        setPeeking(false)
      },
      onClick: (e: React.MouseEvent) => {
        if (opened.current) e.preventDefault()
      },
    },
  }
}

function PeekPanel({ open, peek }: { open: boolean; peek: Mode['peek'] }) {
  if (!peek) return null
  return (
    <div
      className="overflow-hidden transition-[max-height,opacity] duration-[240ms] ease-standard"
      style={{ maxHeight: open ? 96 : 0, opacity: open ? 1 : 0 }}
      aria-hidden={!open}
    >
      <div className="mt-3 border-t border-line pt-3">
        <p className="tabular text-[15px] leading-5 font-bold text-ink">{peek.headline}</p>
        {peek.lines.map((line) => (
          <p key={line} className="text-[11.5px] leading-4 text-muted">
            {line}
          </p>
        ))}
      </div>
    </div>
  )
}

/**
 * The one card the app is nudging towards, inside a gradient edge.
 *
 * The card is a div, not a Link: the "Why this?" control is a button, and a
 * <button> inside an <a> is invalid. The link instead stretches over the card
 * with a full-bleed ::after, and the badge sits above it.
 */
export function SuggestedModeCard({ mode }: { mode: Mode }) {
  const [flipped, setFlipped] = useState(false)
  const reduced = usePrefersReducedMotion()

  // Only the 3D branch ever turns a face away. Under reduced motion both faces
  // stay visible and stacked, so suppressing the front's tab order there would
  // leave a control that is on screen and mouse-clickable but unreachable by
  // keyboard.
  const frontHidden = flipped && !reduced
  const backHidden = !flipped && !reduced

  const front = (
    <div className="relative rounded-[20.5px] bg-card p-4">
      <div className="flex items-center gap-3">
        <span
          className={`grid h-[46px] w-[46px] flex-none place-items-center rounded-[14px] ${TONE_TILE[mode.tone]}`}
        >
          <Icon name={mode.icon} size={24} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-[7px]">
            {/* Stretched link: the ::after covers the whole card, so tapping
                anywhere but the badge still launches the mode. */}
            <Link
              to={mode.to}
              tabIndex={frontHidden ? -1 : undefined}
              className="text-[17px] leading-[22px] font-bold text-ink after:absolute after:inset-0 after:content-['']"
            >
              {mode.name}
            </Link>
            <Pill tone="suggested">Do this next</Pill>
            {mode.why ? (
              <button
                type="button"
                onClick={() => setFlipped(true)}
                tabIndex={frontHidden ? -1 : undefined}
                className="relative z-10 h-[22px] flex-none rounded-full bg-xp px-2.5 text-[9.5px] leading-none font-bold tracking-[0.05em] text-on-xp uppercase"
              >
                Why this?
              </button>
            ) : null}
          </span>
          <span className="block text-[13px] leading-[18px] text-muted">{mode.sub}</span>
        </span>
      </div>
      {mode.detail ? (
        <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
          <Chip tone={mode.detail.chipTone} className="tabular !h-[26px] !px-2.5 !text-xs">
            {mode.detail.chip}
          </Chip>
          <span className="text-[12.5px] leading-[1.3] text-muted">{mode.detail.note}</span>
        </div>
      ) : null}
    </div>
  )

  const back = (
    <div className="flex h-full flex-col justify-center gap-1.5 rounded-[20.5px] bg-ink p-4">
      <p className="text-[10.5px] leading-none font-bold tracking-[0.08em] text-white/55 uppercase">
        Why {mode.name}, why now
      </p>
      <p className="text-[12.5px] leading-[17px] text-white">{mode.why}</p>
      <button
        type="button"
        onClick={() => setFlipped(false)}
        tabIndex={backHidden ? -1 : undefined}
        className="mt-1 h-7 self-start rounded-[9px] bg-white/15 px-2.5 text-[11.5px] font-semibold text-white"
      >
        Flip back
      </button>
    </div>
  )

  // Reduced motion swaps the rotation for a panel underneath: the reasoning is
  // the point, and it must not depend on a 3D transform to be reachable.
  if (reduced) {
    return (
      <div>
        <div className="celebrate rounded-xl p-[1.5px]">{front}</div>
        {flipped ? <div className="celebrate mt-2 rounded-xl p-[1.5px]">{back}</div> : null}
      </div>
    )
  }

  return (
    <div className="celebrate rounded-xl p-[1.5px]" style={{ perspective: 900 }}>
      <div
        className="relative transition-transform duration-[420ms] ease-spring"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        <div style={{ backfaceVisibility: 'hidden' }} inert={flipped || undefined}>
          {front}
        </div>
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          inert={!flipped || undefined}
        >
          {back}
        </div>
      </div>
    </div>
  )
}

export function ModeCard({ mode }: { mode: Mode }) {
  const locked = Boolean(mode.gate)
  const { peeking, handlers } = useHoldToPeek(!locked && Boolean(mode.peek))

  return (
    <Link
      to={mode.to}
      {...handlers}
      className={`${CARD} block rounded-[20px] p-3.5 transition-transform duration-[90ms] ease-standard active:scale-[0.985] ${
        locked ? 'opacity-60' : ''
      }`}
    >
      <span className="flex items-center gap-3">
        <span
          className={`grid h-11 w-11 flex-none place-items-center rounded-[14px] ${
            locked ? 'bg-line text-muted' : TONE_TILE[mode.tone]
          }`}
        >
          <Icon name={mode.icon} size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15.5px] leading-5 font-bold text-ink">{mode.name}</span>
          <span className="block text-[12.5px] leading-[17px] text-muted">{mode.sub}</span>
          {mode.gate ? null : (
            <span
              className={`tabular mt-0.5 block text-[12.5px] leading-[17px] font-semibold ${TONE_TEXT[mode.tone]}`}
            >
              {peeking ? 'Release to close' : mode.stat}
            </span>
          )}
        </span>
        {mode.gate ? (
          <span className="flex-none text-[11.5px] font-semibold text-muted">{mode.gate}</span>
        ) : (
          <Icon name="chevronRight" size={18} strokeWidth={2.2} className="flex-none text-muted" />
        )}
      </span>
      <PeekPanel open={peeking} peek={mode.peek} />
    </Link>
  )
}
