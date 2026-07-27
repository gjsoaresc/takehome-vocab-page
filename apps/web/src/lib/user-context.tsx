import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ErrorState, LoadingState } from '../components/States'
import { getOrCreateUserId } from './user'

const UserContext = createContext<string | null>(null)

/** Blocks rendering until the anonymous user exists on the server. */
export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    getOrCreateUserId()
      .then((id) => {
        if (!cancelled) setUserId(id)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    const onReset = (e: Event) => setUserId((e as CustomEvent<string>).detail)
    window.addEventListener('vocab:user-reset', onReset)
    return () => {
      cancelled = true
      window.removeEventListener('vocab:user-reset', onReset)
    }
  }, [attempt])

  if (error)
    return (
      <ErrorState
        message={`Could not reach the server (${error}). Is the API running?`}
        onRetry={() => {
          setError(null)
          setAttempt((a) => a + 1)
        }}
      />
    )
  if (!userId) return <LoadingState label="Setting things up" />
  return <UserContext.Provider value={userId}>{children}</UserContext.Provider>
}

export function useUserId(): string {
  const id = useContext(UserContext)
  if (!id) throw new Error('useUserId outside UserProvider')
  return id
}
