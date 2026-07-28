import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/**
 * The global `1ms` override in index.css stops things moving; this hook is for
 * the cases CSS cannot express - skipping a count-up so the final value renders
 * on the first frame, holding a chip in place instead of floating it away.
 * Every caller must still communicate the same information without the motion.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}

/**
 * True once the element has scrolled into view, and true forever after - the
 * entrance is a once-per-visit thing, not something that replays every time you
 * scroll past.
 *
 * Starts true where IntersectionObserver does not exist. That is not a
 * politeness: callers gate a real value on this flag, so failing closed would
 * leave a bar sitting at zero and silently misreport the data.
 */
export function useInView<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    if (inView || !ref.current) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setInView(true)
        observer.disconnect()
      }
    })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [inView])

  return [ref, inView]
}
