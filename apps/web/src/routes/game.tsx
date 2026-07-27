import type { GameCardDto } from '@vocab/shared'
import { useEffect, useRef, useState } from 'react'
import { ErrorState, LoadingState } from '../components/States'
import { GameOver } from '../components/game/GameOver'
import { RushCard } from '../components/game/RushCard'
import { api } from '../lib/api'
import { sendEvent } from '../lib/events'
import { useUserId } from '../lib/user-context'

const GAME_SECONDS = 90
const DECK_SIZE = 60

interface PlayState {
  cards: GameCardDto[]
  index: number
  score: number
  streak: number
  bestStreak: number
  correct: number
  missed: GameCardDto[]
  flash: 'hit' | 'miss' | null
}

type Phase =
  | { name: 'intro' }
  | { name: 'loading' }
  | { name: 'error'; message: string }
  | { name: 'playing'; state: PlayState }
  | { name: 'done'; state: PlayState }

const multiplierFor = (streak: number) => Math.min(4, 1 + Math.floor(streak / 5))

export default function Game() {
  const userId = useUserId()
  const [phase, setPhase] = useState<Phase>({ name: 'intro' })
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Absolute deadline: judgments must not reset the clock.
  const endAt = useRef(0)
  const finishedSent = useRef(false)
  const playing = phase.name === 'playing'

  useEffect(() => {
    if (!playing) return
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000))
      setTimeLeft(left)
      if (left <= 0) {
        setPhase((p) => (p.name === 'playing' ? { name: 'done', state: p.state } : p))
      }
    }, 250)
    return () => clearInterval(tick)
  }, [playing])

  // The final score becomes an event exactly once per run.
  useEffect(() => {
    if (phase.name !== 'done' || finishedSent.current) return
    finishedSent.current = true
    const { state } = phase
    void sendEvent({
      user_id: userId,
      mode: 'game',
      type: 'game_finished',
      payload: {
        score: state.score,
        best_streak: state.bestStreak,
        judged: state.index,
        correct: state.correct,
      },
    })
  }, [phase, userId])

  async function start() {
    setPhase({ name: 'loading' })
    try {
      const { cards } = await api.gameNext(userId, DECK_SIZE)
      if (cards.length === 0) {
        setPhase({ name: 'error', message: 'No words available - seed the database first.' })
        return
      }
      endAt.current = Date.now() + GAME_SECONDS * 1000
      finishedSent.current = false
      setTimeLeft(GAME_SECONDS)
      setPhase({
        name: 'playing',
        state: {
          cards,
          index: 0,
          score: 0,
          streak: 0,
          bestStreak: 0,
          correct: 0,
          missed: [],
          flash: null,
        },
      })
    } catch (err) {
      setPhase({ name: 'error', message: (err as Error).message })
    }
  }

  function judge(saysMatch: boolean) {
    if (phase.name !== 'playing') return
    const s = phase.state
    const card = s.cards[s.index % s.cards.length]!
    const correct = saysMatch === card.is_match
    void sendEvent({
      user_id: userId,
      mode: 'game',
      type: 'graded',
      word_id: card.word_id,
      sense_id: card.sense_id,
      correct,
      payload: { says_match: saysMatch, is_match: card.is_match },
    })
    const streak = correct ? s.streak + 1 : 0
    const next: PlayState = {
      ...s,
      index: s.index + 1,
      score: correct ? s.score + 10 * multiplierFor(s.streak) : s.score,
      streak,
      bestStreak: Math.max(s.bestStreak, streak),
      correct: s.correct + (correct ? 1 : 0),
      missed: correct ? s.missed : [...s.missed, card],
      flash: correct ? 'hit' : 'miss',
    }
    setPhase({ name: 'playing', state: next })
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => {
      setPhase((p) =>
        p.name === 'playing' ? { name: 'playing', state: { ...p.state, flash: null } } : p,
      )
    }, 450)
  }

  if (phase.name === 'intro') {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Word Rush</h1>
        <div className="rounded-xl border border-line bg-card p-5">
          <p className="font-semibold">90 seconds. One thumb. Read fast.</p>
          <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
            <li>A word and a definition appear together.</li>
            <li>Swipe right (or tap Match) if they belong together.</li>
            <li>Swipe left (or tap No match) if they do not.</li>
            <li>Streaks multiply your points, up to x4. A miss resets it.</li>
          </ul>
        </div>
        <button
          type="button"
          onClick={() => void start()}
          className="tap rounded-xl bg-accent px-5 py-3 font-semibold text-white active:bg-accent-strong"
        >
          Start
        </button>
      </div>
    )
  }

  if (phase.name === 'loading') return <LoadingState label="Shuffling the deck" />
  if (phase.name === 'error') return <ErrorState message={phase.message} onRetry={() => void start()} />
  if (phase.name === 'done')
    return (
      <GameOver
        score={phase.state.score}
        bestStreak={phase.state.bestStreak}
        judged={phase.state.index}
        correct={phase.state.correct}
        missed={phase.state.missed}
        onReplay={() => void start()}
      />
    )

  const s = phase.state
  const card = s.cards[s.index % s.cards.length]!
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm font-semibold">
        <span
          className={`rounded-full px-3 py-1 ${timeLeft <= 10 ? 'bg-err-soft text-err' : 'bg-card text-muted border border-line'}`}
        >
          {timeLeft}s
        </span>
        <span aria-live="polite" className="text-lg font-bold">
          {s.score}
        </span>
        <span className="rounded-full border border-line bg-card px-3 py-1 text-muted">
          x{multiplierFor(s.streak)} streak {s.streak}
        </span>
      </div>

      <div className="relative">
        <RushCard key={s.index} card={card} onJudge={judge} />
        {s.flash ? (
          <span
            className={`pointer-events-none absolute right-3 top-3 rounded-full px-3 py-1 text-sm font-bold ${
              s.flash === 'hit' ? 'bg-ok-soft text-ok' : 'bg-err-soft text-err'
            }`}
          >
            {s.flash === 'hit' ? `✓ +${10 * multiplierFor(s.streak - 1)}` : '✗ streak lost'}
          </span>
        ) : null}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => judge(false)}
          className="tap flex-1 rounded-xl border-2 border-err bg-err-soft py-3 font-bold text-err active:opacity-80"
        >
          ✗ No match
        </button>
        <button
          type="button"
          onClick={() => judge(true)}
          className="tap flex-1 rounded-xl border-2 border-ok bg-ok-soft py-3 font-bold text-ok active:opacity-80"
        >
          ✓ Match
        </button>
      </div>
    </div>
  )
}
