import { api } from './api'

/**
 * The offline write path.
 *
 * A failed POST /api/events is parked in localStorage and replayed later. This
 * is safe by construction rather than by careful coding: every event body
 * already carries a client-generated `event_id`, and record_event() drops a
 * duplicate on that unique index (packages/db/functions.sql), so replaying the
 * queue can never double-count an action. Nothing here needs a server change.
 */

const KEY = 'vocab.outbox'

type Body = Record<string, unknown>

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((fn) => fn())

function read(): Body[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Body[]) : []
  } catch {
    return []
  }
}

function write(items: Body[]): void {
  if (items.length === 0) localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, JSON.stringify(items))
  notify()
}

export function enqueue(body: Body): void {
  write([...read(), body])
}

let flushing = false

/**
 * Send everything queued, oldest first. Stops at the first transport failure so
 * ordering is preserved; a body the server actively rejects is dropped rather
 * than retried forever.
 */
export async function flush(): Promise<void> {
  if (flushing) return
  flushing = true
  try {
    let queue = read()
    while (queue.length > 0) {
      const [next, ...rest] = queue
      try {
        await api.postEvent(next!)
      } catch (err) {
        // A real HTTP status means the server saw it and said no - drop it and
        // keep going. No status means we never reached the server: stop here
        // and leave the rest queued for the next attempt.
        if ((err as { status?: number }).status === undefined) return
      }
      queue = rest
      write(queue)
    }
  } finally {
    flushing = false
  }
}

export const pendingCount = (): number => read().length

export function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

/** Retry as soon as the network comes back. Idempotent - safe to call twice. */
let wired = false
export function watchConnection(): void {
  if (wired) return
  wired = true
  window.addEventListener('online', () => void flush())
  if (navigator.onLine) void flush()
}
