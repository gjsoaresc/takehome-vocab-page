import { useEffect, useRef, useState } from 'react'
import { goalRippleClaimed, markGoalRipple } from '../../lib/reward-store'
import { ringTicks, type FlameTier } from '../../lib/rewards'
import { Flame } from '../ui/Flame'

/** Ring geometry. The ticks sit inside 184px with room for their round caps. */
const SIZE = 184
const CENTRE = SIZE / 2
const TICK_INNER = 74
const TICK_OUTER = 86
const TICK_WIDTH = 10
/** The goal-met ripple runs just inside the ticks, so it reads as the ring closing. */
const RIPPLE_SIZE = TICK_INNER * 2

/** Poking the flame: three inside a fixed window earns a flare. */
const FLAME_SIZE = 40
const POKE_TARGET = 3
const POKE_WINDOW_MS = 1500
const FLARE_HOLD_MS = 800
const FLARE_SIZE = FLAME_SIZE + 24

/**
 * The daily-goal ring with the streak inside it - the first thing on Home.
 *
 * The ring is one tick per review the goal asks for, not a smooth arc: a
 * review is a discrete thing you did, so it lands as a discrete mark. The
 * count is the learner's own goal (8-20), never a fixed twelve.
 *
 * Zero state gets a dashed empty track and no numbers at all: a brand-new
 * learner is never shown a fabricated streak.
 */
export function GoalRing({
  done,
  goal,
  streak,
  flame,
  fresh = false,
}: {
  done: number
  goal: number
  streak: number
  flame: FlameTier
  fresh?: boolean
}) {
  // reviewsToday can outrun the goal, so the fill is clamped.
  const filled = Math.min(done, goal)
  const goalMet = goal > 0 && done >= goal

  // Decided once, from a pure read: the ripple is the day's one celebration of
  // closing the ring, so a stats refetch or any other re-render must not replay
  // it. `burst` ends on `forwards` at opacity 0, so the element can simply stay
  // mounted afterwards - no timer to run, and none to clean up.
  const today = new Date().toISOString().slice(0, 10)
  const [rippling] = useState(() => goalMet && !goalRippleClaimed(today))

  useEffect(() => {
    if (rippling) markGoalRipple(today)
  }, [rippling, today])

  // The flame is a pet, not a control: poking it does nothing but wiggle, and
  // three pokes inside the window earn a flare. The window is fixed from the
  // first poke rather than re-armed by each one, so "three inside 1.5s" means
  // what it says instead of drifting with a slow tap.
  // The count lives in a ref, not state: nothing renders from it, and reading
  // it from state would hand successive pokes in one tick the same stale value.
  const pokes = useRef(0)
  const [pokeKey, setPokeKey] = useState(0)
  const [flareKey, setFlareKey] = useState(0)
  // The warm backing is not decoration: it is 9b's reduced-motion state. With
  // motion off the wiggle and the ring both collapse to nothing, and this tint
  // is all that is left to say "it liked that".
  const [flaring, setFlaring] = useState(false)
  const pokeWindow = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const flareHold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Home unmounts on every route change; a pending timer would otherwise call
  // setState afterwards.
  useEffect(
    () => () => {
      clearTimeout(pokeWindow.current)
      clearTimeout(flareHold.current)
    },
    [],
  )

  function poke() {
    setPokeKey((k) => k + 1)
    pokes.current += 1

    if (pokes.current >= POKE_TARGET) {
      pokes.current = 0
      clearTimeout(pokeWindow.current)
      setFlareKey((k) => k + 1)
      setFlaring(true)
      clearTimeout(flareHold.current)
      flareHold.current = setTimeout(() => setFlaring(false), FLARE_HOLD_MS)
      return
    }

    // Only the opening poke arms the window, so the run is a fixed 1.5s rather
    // than one that slides forward with every tap.
    if (pokes.current === 1) {
      pokeWindow.current = setTimeout(() => {
        pokes.current = 0
      }, POKE_WINDOW_MS)
    }
  }

  if (fresh) {
    return (
      <div className="relative grid h-[168px] w-[168px] place-items-center">
        <svg width="168" height="168" viewBox="0 0 168 168" aria-hidden="true">
          <circle
            cx="84"
            cy="84"
            r="71"
            fill="none"
            stroke="var(--color-line)"
            strokeWidth="13"
            strokeDasharray="4 11"
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute flex flex-col items-center gap-1.5">
          <Flame tier="none" size={38} />
          <span className="max-w-[110px] text-center text-[13px] leading-[17px] font-semibold text-muted">
            Your streak
            <br />
            starts today
          </span>
        </span>
      </div>
    )
  }

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      {/* role=img with a label makes the ticks presentational, so they carry no
          individual semantics - the sentence below is the whole announcement. */}
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`${done} of ${goal} reviews done today`}
      >
        {ringTicks(goal, TICK_INNER, TICK_OUTER, CENTRE).map((tick, i) => (
          <line
            key={i}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            strokeWidth={TICK_WIDTH}
            strokeLinecap="round"
            stroke={
              i < filled
                ? goalMet
                  ? 'var(--color-gold)'
                  : 'var(--color-accent)'
                : 'var(--color-line)'
            }
            // Only the newest tick pops. The class lands on a line that did not
            // have it a render ago, which is what starts the animation - no key
            // remount needed, because the popping index moves with every review.
            className={i === filled - 1 ? 'animate-tick-pop' : undefined}
            style={{ transformBox: 'view-box', transformOrigin: `${CENTRE}px ${CENTRE}px` }}
          />
        ))}
      </svg>

      {rippling ? (
        <div
          aria-hidden
          className="animate-burst absolute top-1/2 left-1/2 rounded-full border-[3px] border-gold"
          style={{ width: RIPPLE_SIZE, height: RIPPLE_SIZE }}
        />
      ) : null}

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* The hit area is grown with a pseudo-element rather than padding or
            the `tap` utility: both set real box size, which would push the
            streak number below it down by 4px. */}
        <button
          type="button"
          onClick={poke}
          aria-label="Poke the streak flame"
          className={`relative grid place-items-center rounded-full transition-colors duration-300 after:absolute after:-inset-1 after:content-[''] ${
            flaring ? 'bg-flame-soft' : 'bg-transparent'
          }`}
          style={{ width: FLAME_SIZE, height: FLAME_SIZE }}
        >
          {flareKey > 0 ? (
            <span
              key={flareKey}
              aria-hidden
              className="animate-burst absolute top-1/2 left-1/2 rounded-full border-2 border-flame"
              style={{ width: FLARE_SIZE, height: FLARE_SIZE }}
            />
          ) : null}
          {/* The wiggle rides a wrapper, never the Flame itself: a day7+ tier
              already carries `animate-flicker`, and both set the `animation`
              shorthand. On one element the later-declared token wins outright,
              so a single poke would kill the ambient flicker for good. On two
              elements the transforms simply compose. */}
          <span
            key={pokeKey}
            className={pokeKey > 0 ? 'animate-wiggle inline-flex' : 'inline-flex'}
          >
            <Flame tier={flame} size={FLAME_SIZE} />
          </span>
        </button>
        <span className="tabular text-[44px] leading-[44px] font-bold tracking-[-0.03em] text-ink">
          {streak}
        </span>
        <span
          className={`text-[11px] leading-none font-semibold tracking-[0.08em] uppercase ${
            flame === 'atRisk' ? 'text-warn' : 'text-flame'
          }`}
        >
          {flame === 'atRisk' ? 'at risk' : `day streak`}
        </span>
      </div>
    </div>
  )
}
