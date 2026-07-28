import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '../../lib/motion'

const DURATION = 420
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

export const group = (n: number) => n.toLocaleString('en-US')

/**
 * Number roll-up: 420ms ease-out, tabular figures so nothing shifts while it
 * counts. Reduced motion renders the final value on the first frame - the
 * number is the information, the travel was only decoration.
 */
export function CountUp({
  to,
  prefix = '',
  suffix = '',
  className = '',
}: {
  to: number
  prefix?: string
  suffix?: string
  className?: string
}) {
  const reduced = usePrefersReducedMotion()
  const [animated, setAnimated] = useState(0)
  const frame = useRef(0)

  useEffect(() => {
    if (reduced) return
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION)
      setAnimated(Math.round(to * easeOut(t)))
      if (t < 1) frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame.current)
  }, [to, reduced])

  // Derived, never assigned in the effect: reduced motion shows the final value
  // on the very first frame instead of counting to it.
  const value = reduced ? to : animated

  return (
    <span className={`tabular ${className}`}>
      {prefix}
      {group(value)}
      {suffix}
    </span>
  )
}
