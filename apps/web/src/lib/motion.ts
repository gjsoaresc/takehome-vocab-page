import { useSyncExternalStore } from 'react'

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
