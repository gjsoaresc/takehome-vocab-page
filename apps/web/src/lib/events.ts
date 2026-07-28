import type { EventResult, EventType, Mode } from '@vocab/shared'
import { api } from './api'
import { enqueue, flush } from './outbox'
import { recreateUser } from './user'

export interface StudyEvent {
  user_id: string
  mode: Mode
  type: EventType
  word_id?: number
  sense_id?: number
  correct?: boolean
  rating?: number
  payload?: Record<string, unknown>
}

/** `queued` means the write is parked locally, so `progress` is not server truth yet. */
export type SendResult = EventResult & { queued: boolean }

/**
 * The single write path. Generates the idempotency key (event_id) client-side
 * so a retry or double-tap of the SAME action cannot be counted twice.
 *
 * If the server no longer knows the user (database was reseeded), a fresh user
 * is created once and the event retried under the new id. If the network is
 * unreachable the event goes to the outbox and resolves optimistically - the
 * caller must never stall, and a queued write must never look lost.
 */
export async function sendEvent(event: StudyEvent): Promise<SendResult> {
  const body = { event_id: crypto.randomUUID(), ...event }
  try {
    const result = await api.postEvent(body)
    // A successful write means we are online again; drain anything waiting.
    void flush()
    return { ...result, queued: false }
  } catch (err) {
    const status = (err as { status?: number }).status
    if (status === 404) {
      const userId = await recreateUser()
      window.dispatchEvent(new CustomEvent('vocab:user-reset', { detail: userId }))
      return { ...(await api.postEvent({ ...body, user_id: userId })), queued: false }
    }
    // No status at all is a transport failure rather than a rejection: park it.
    if (status === undefined) {
      enqueue(body)
      return { duplicate: false, progress: null, queued: true }
    }
    throw err
  }
}
