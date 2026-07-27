import type { EventResult, EventType, Mode } from '@vocab/shared'
import { api } from './api'
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

/**
 * The single write path. Generates the idempotency key (event_id) client-side
 * so a retry or double-tap of the SAME action cannot be counted twice.
 * If the server no longer knows the user (database was reseeded), a fresh
 * user is created once and the event retried under the new id.
 */
export async function sendEvent(event: StudyEvent): Promise<EventResult> {
  const body = { event_id: crypto.randomUUID(), ...event }
  try {
    return await api.postEvent(body)
  } catch (err) {
    if ((err as { status?: number }).status === 404) {
      const userId = await recreateUser()
      window.dispatchEvent(new CustomEvent('vocab:user-reset', { detail: userId }))
      return api.postEvent({ ...body, user_id: userId })
    }
    throw err
  }
}
