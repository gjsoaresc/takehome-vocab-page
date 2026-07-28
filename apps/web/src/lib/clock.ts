import { useSyncExternalStore } from 'react'

const MINUTE = 60_000

function subscribe(onChange: () => void): () => void {
  const id = setInterval(onChange, MINUTE)
  return () => clearInterval(id)
}

/**
 * The wall clock, as an external store so the greeting stays live without
 * reading Date.now() during render. Ticks once a minute - nothing on screen
 * needs finer resolution than "6:42 pm".
 */
export function useMinute(): number {
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / MINUTE),
    () => 0,
  )
}

export function useNow(): Date {
  return new Date(useMinute() * MINUTE)
}

export const weekday = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long' })

export const clockTime = (d: Date) =>
  d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()

export type TimeOfDay = 'morning' | 'afternoon' | 'night'

/**
 * Which of the three header palettes the hour belongs to.
 *
 * Local wall clock, deliberately - unlike the day keys in rewards.ts, which are
 * UTC because they have to line up with the API. This one is about what the room
 * looks like to the learner.
 */
export function timeOfDay(d: Date): TimeOfDay {
  const hour = d.getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'night'
}
