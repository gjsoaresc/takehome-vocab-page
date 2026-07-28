import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { BoardResult, clock } from '../components/matching/BoardResult'
import { MatchBoard } from '../components/matching/MatchBoard'
import { BoardSkeleton, EmptyState, ErrorState, useMinimumDuration } from '../components/States'
import { Icon } from '../components/ui/Icon'
import { api } from '../lib/api'
import { useMinute } from '../lib/clock'
import { sendEvent } from '../lib/events'
import { useUserId } from '../lib/user-context'

const RECORD_KEY = 'vocab.matching_best'
/** The design's scoring: 10 XP a pair, +40 for a clean board. */
const XP_PER_PAIR = 10
const XP_CLEAN_BONUS = 40

interface Record_ {
  seconds: number
  accuracy: number
}

const readRecord = (): Record_ | null => {
  try {
    const raw = localStorage.getItem(RECORD_KEY)
    return raw ? (JSON.parse(raw) as Record_) : null
  } catch {
    return null
  }
}

/**
 * Board timer. It counts up and never ends the board - it only feeds the
 * record line on the results card, so there is no reason to guess.
 */
function useBoardSeconds(running: boolean, resetKey: number): number {
  const [seconds, setSeconds] = useState(0)
  const [key, setKey] = useState(resetKey)
  // Derive during render rather than resetting from an effect: a new board
  // starts its clock at zero on the same commit that swaps the board in.
  if (key !== resetKey) {
    setKey(resetKey)
    setSeconds(0)
  }
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [running, resetKey])
  return seconds
}

export default function Matching() {
  const userId = useUserId()
  const [round, setRound] = useState(0)
  const [moves, setMoves] = useState(0)
  const [finished, setFinished] = useState<{ attempts: number; pairs: number; seconds: number } | null>(
    null,
  )
  useMinute()

  const boardQuery = useQuery({
    queryKey: ['matching', userId, round],
    queryFn: () => api.matchingNext(userId),
    staleTime: Infinity,
    gcTime: 0,
  })
  const showSkeleton = useMinimumDuration(boardQuery.isLoading)
  const seconds = useBoardSeconds(!finished && !boardQuery.isLoading, round)

  const again = useCallback(() => {
    setFinished(null)
    setMoves(0)
    setRound((r) => r + 1)
  }, [])

  if (showSkeleton)
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl leading-7 font-bold tracking-[-0.02em] text-ink">Matching</h1>
        <BoardSkeleton />
        <p className="text-center text-[12.5px] leading-[17px] text-muted">Dealing a fresh board...</p>
      </div>
    )

  if (boardQuery.isError)
    return (
      <ErrorState
        title="Couldn't deal a board"
        message="We need six pairs you've already seen. Check your connection and try again."
        onRetry={() => void boardQuery.refetch()}
        altLabel="Practise in Learn instead"
        onAlt={() => void boardQuery.refetch()}
      />
    )

  const pairs = boardQuery.data?.pairs ?? []
  if (pairs.length < 2)
    return (
      <EmptyState
        where="matching"
        icon="match"
        title="Not enough pairs yet"
        hint={`A board is six pairs. You have ${pairs.length} - rate a few more in Learn and the board deals.`}
      />
    )

  if (finished) {
    const clean = finished.attempts === finished.pairs
    const accuracy = finished.pairs / finished.attempts
    const record = readRecord()
    const isRecord =
      clean && (record === null || record.accuracy < 1 || finished.seconds < record.seconds)
    if (isRecord) {
      localStorage.setItem(
        RECORD_KEY,
        JSON.stringify({ seconds: finished.seconds, accuracy } satisfies Record_),
      )
    }
    return (
      <BoardResult
        pairs={finished.pairs}
        moves={finished.attempts}
        seconds={finished.seconds}
        xpEarned={finished.pairs * XP_PER_PAIR + (clean ? XP_CLEAN_BONUS : 0)}
        record={isRecord ? { seconds: finished.seconds, accuracy } : record}
        isRecord={isRecord}
        onAgain={again}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl leading-[25px] font-bold tracking-[-0.02em] text-ink">Matching</h1>
          <p className="tabular text-xs leading-4 text-muted">
            {pairs.length} pairs - tap a word then its meaning, or drag one across
          </p>
        </div>
        <span className="tabular inline-flex h-8 flex-none items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 text-xs font-semibold text-muted">
          <Icon name="timer" size={13} strokeWidth={2.2} />
          {clock(seconds)}
        </span>
        <span className="tabular inline-flex h-8 flex-none items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 text-xs font-semibold text-muted">
          <Icon name="swap" size={13} strokeWidth={2.2} />
          {moves}
        </span>
      </div>

      <MatchBoard
        key={round}
        pairs={pairs}
        onMove={setMoves}
        onAttempt={(wordId, correct) =>
          void sendEvent({
            user_id: userId,
            mode: 'matching',
            type: 'matched',
            word_id: wordId,
            correct,
          })
        }
        onComplete={(attempts) => setFinished({ attempts, pairs: pairs.length, seconds })}
      />
    </div>
  )
}
