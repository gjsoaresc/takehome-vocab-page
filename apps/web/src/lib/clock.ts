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
