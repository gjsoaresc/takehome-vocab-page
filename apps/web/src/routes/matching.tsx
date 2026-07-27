import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { MatchBoard } from '../components/matching/MatchBoard'
import { api } from '../lib/api'
import { sendEvent } from '../lib/events'
import { useUserId } from '../lib/user-context'

export default function Matching() {
  const userId = useUserId()
  const [round, setRound] = useState(0)
  const [finished, setFinished] = useState<{ attempts: number; pairs: number } | null>(null)
  const boardQuery = useQuery({
    queryKey: ['matching', userId, round],
    queryFn: () => api.matchingNext(userId),
    staleTime: Infinity,
    gcTime: 0,
  })

  if (boardQuery.isLoading) return <LoadingState label="Dealing the board" />
  if (boardQuery.isError)
    return (
      <ErrorState
        message="Could not load a matching board."
        onRetry={() => void boardQuery.refetch()}
      />
    )

  const pairs = boardQuery.data?.pairs ?? []
  if (pairs.length < 2)
    return (
      <EmptyState title="Not enough words yet" hint="Seed the database to play Matching." />
    )

  if (finished) {
    const accuracy = Math.round((finished.pairs / finished.attempts) * 100)
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-line bg-card p-5 text-center">
          <p className="text-sm font-semibold text-muted">Board cleared</p>
          <p className="mt-1 text-3xl font-bold">{accuracy}% accuracy</p>
          <p className="mt-1 text-sm text-muted">
            {finished.pairs} pairs in {finished.attempts} attempts
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFinished(null)
            setRound((r) => r + 1)
          }}
          className="tap rounded-xl bg-accent px-5 font-semibold text-white active:bg-accent-strong"
        >
          Play again
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-2xl font-bold">Matching</h1>
        <p className="text-sm text-muted">
          Tap a word then its definition, or drag a word onto one.
        </p>
      </div>
      <MatchBoard
        key={round}
        pairs={pairs}
        onAttempt={(wordId, correct) =>
          void sendEvent({
            user_id: userId,
            mode: 'matching',
            type: 'matched',
            word_id: wordId,
            correct,
          })
        }
        onComplete={(attempts) => setFinished({ attempts, pairs: pairs.length })}
      />
    </div>
  )
}
