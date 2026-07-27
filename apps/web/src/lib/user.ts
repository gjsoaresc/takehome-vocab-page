import { api } from './api'

// localStorage holds ONLY the anonymous user id (identity cache) - all
// progress lives on the server.
const KEY = 'vocab.user_id'

export async function getOrCreateUserId(): Promise<string> {
  const cached = localStorage.getItem(KEY)
  if (cached) return cached
  const { id } = await api.createUser()
  localStorage.setItem(KEY, id)
  return id
}

/** After a database reseed the stored id is stale: mint a fresh user. */
export async function recreateUser(): Promise<string> {
  localStorage.removeItem(KEY)
  return getOrCreateUserId()
}
