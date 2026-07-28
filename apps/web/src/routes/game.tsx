import type { GameCardDto } from '@vocab/shared'
import { useEffect, useRef, useState } from 'react'
import { ErrorState, LoadingState } from '../components/States'
import { GameOver, type MissedPair } from '../components/game/GameOver'
import { RushCard } from '../components/game/RushCard'
import { RushHud } from '../components/game/RushHud'
import { XpFloat } from '../components/reward/XpFloat'
import { Button } from '../components/ui/Button'
import { CARD } from '../components/ui/Card'
import { Chip } from '../components/ui/Chip'
import { Icon } from '../components/ui/Icon'
import { api } from '../lib/api'
import { sendEvent } from '../lib/events'
import { getBestRun, rememberRun } from '../lib/reward-store'
import { XP } from '../lib/rewards'
import { useUserId } from '../lib/user-context'

const GAME_SECONDS = 90
const DECK_SIZE = 60
/** Below this the HUD escalates: solid fill, tenths, and a pulse. */
const URGENT_MS = 10_000

interface PlayState {
  cards: GameCardDto[]
  index: number
  score: number
  streak: number
  bestStreak: number
  correct: number
  missed: MissedPair[]
  beat: { ok: boolean; text: string; sub: string } | null
  levelUp: string | null
}

type Phase =
  | { name: 'intro' }
  | { name: 'loading' }
  | { name: 'error'; message: string }
  | { name: 'playing'; state: PlayState }
  | { name: 'done'; state: PlayState }

const multiplierFor = (streak: number) => Math.min(4, 1 + Math.floor(streak / 5))

const MULT_STEPS = [
  { label: 'x1', at: 'start', cls: 'border-line bg-card text-muted' },
  { label: 'x2', at: '5 streak', cls: 'border-warn bg-warn-soft text-warn' },
  { label: 'x3', at: '10 streak', cls: 'border-flame bg-flame-soft text-flame' },
  { label: 'x4', at: '15 streak', cls: 'border-flame bg-flame text-on-flame' },
]

export default function Game() {
  const userId = useUserId()
  const [phase, setPhase] = useState<Phase>({ name: 'intro' })
  const [msLeft, setMsLeft] = useState(GAME_SECONDS * 1000)
  const beatTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const levelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Absolute deadline: judgments must not reset the clock.
  const endAt = useRef(0)
  const finishedSent = useRef(false)
  const [bestBefore] = useState(getBestRun)
  const playing = phase.name === 'playing'

  useEffect(() => {
    if (!playing) return
    const tick = setInterval(() => {
      const left = Math.max(0, endAt.current - Date.now())
      setMsLeft(left)
      if (left <= 0) {
        setPhase((p) => (p.name === 'playing' ? { name: 'done', state: p.state } : p))
      }
    }, 100)
    return () => clearInterval(tick)
  }, [playing])

  // The final score becomes an event exactly once per run.
  useEffect(() => {
    if (phase.name !== 'done' || finishedSent.current) return
    finishedSent.current = true
    const { state } = phase
    rememberRun(state.score)
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
      setMsLeft(GAME_SECONDS * 1000)
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
          beat: null,
          levelUp: null,
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
    const before = multiplierFor(s.streak)
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
    const after = multiplierFor(streak)
    const next: PlayState = {
      ...s,
      index: s.index + 1,
      score: correct ? s.score + 10 * before : s.score,
      streak,
      bestStreak: Math.max(s.bestStreak, streak),
      correct: s.correct + (correct ? 1 : 0),
      missed: correct
        ? s.missed
        : [
            ...s.missed,
            {
              card,
              note: card.is_match
                ? 'you said no match - it was one'
                : `decoy: ${card.definition}`,
            },
          ],
      beat: correct
        ? { ok: true, text: `+${10 * before}`, sub: '' }
        : { ok: false, text: 'Wrong', sub: `${card.headword} = ${card.definition}` },
      levelUp: correct && after > before ? `x${after}` : null,
    }
    setPhase({ name: 'playing', state: next })

    if (beatTimer.current) clearTimeout(beatTimer.current)
    beatTimer.current = setTimeout(() => {
      setPhase((p) => (p.name === 'playing' ? { name: 'playing', state: { ...p.state, beat: null } } : p))
    }, 700)

    if (next.levelUp) {
      if (levelTimer.current) clearTimeout(levelTimer.current)
      levelTimer.current = setTimeout(() => {
        setPhase((p) =>
          p.name === 'playing' ? { name: 'playing', state: { ...p.state, levelUp: null } } : p,
        )
      }, 900)
    }
  }

  if (phase.name === 'intro') {
    return (
      <div className="flex flex-col gap-4">
        <Chip tone="flame" icon="flame" iconFilled className="self-start uppercase">
          90 seconds
        </Chip>
        <div>
          <h1 className="text-[40px] leading-[42px] font-bold tracking-[-0.03em] text-ink">
            Word
            <br />
            Rush
          </h1>
          <p className="mt-2.5 max-w-[290px] text-[15px] leading-[22px] text-muted">
            A word and a meaning. Swipe right if they match, left if they don&apos;t. Decoys share
            the part of speech, so read carefully.
          </p>
        </div>

        <div className="flex gap-2.5">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-err/30 bg-err-soft px-3 py-2.5">
            <Icon name="arrowLeft" size={18} strokeWidth={2.8} className="text-err" />
            <div>
              <div className="text-[12.5px] leading-4 font-bold text-err">Swipe left</div>
              <div className="text-[11px] leading-[15px] text-ink">No match</div>
            </div>
          </div>
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-ok/30 bg-ok-soft px-3 py-2.5">
            <Icon name="arrowRight" size={18} strokeWidth={2.8} className="text-ok" />
            <div>
              <div className="text-[12.5px] leading-4 font-bold text-ok">Swipe right</div>
              <div className="text-[11px] leading-[15px] text-ink">Match</div>
            </div>
          </div>
        </div>

        <div className={`${CARD} flex items-center justify-around p-4`}>
          {MULT_STEPS.map((m) => (
            <div key={m.label} className="flex flex-col items-center gap-1.5">
              <span
                className={`grid h-[54px] w-[54px] place-items-center rounded-[18px] border-[1.5px] text-[19px] font-extrabold ${m.cls}`}
              >
                {m.label}
              </span>
              <span className="text-[10.5px] leading-[1.3] font-medium text-muted">{m.at}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <div className={`${CARD} flex-1 px-2 py-2.5 text-center`}>
            <div className="tabular text-[17px] leading-[22px] font-bold text-gold">
              {bestBefore || '-'}
            </div>
            <div className="text-[10.5px] leading-[14px] font-medium text-muted">
              best on this device
            </div>
          </div>
          <div className={`${CARD} flex-1 px-2 py-2.5 text-center`}>
            <div className="text-[17px] leading-[22px] font-bold text-flame">x4</div>
            <div className="text-[10.5px] leading-[14px] font-medium text-muted">max multiplier</div>
          </div>
          <div className={`${CARD} flex-1 px-2 py-2.5 text-center`}>
            <div className="tabular text-[17px] leading-[22px] font-bold text-accent-strong">
              0:90
            </div>
            <div className="text-[10.5px] leading-[14px] font-medium text-muted">on the clock</div>
          </div>
        </div>

        <Button variant="flame" full onClick={() => void start()} className="!rounded-[18px]">
          Start the 90
        </Button>
      </div>
    )
  }

  if (phase.name === 'loading') return <LoadingState label="Shuffling the deck" />
  if (phase.name === 'error')
    return <ErrorState message={phase.message} onRetry={() => void start()} />

  if (phase.name === 'done') {
    const s = phase.state
    return (
      <GameOver
        score={s.score}
        bestStreak={s.bestStreak}
        judged={s.index}
        correct={s.correct}
        xpEarned={Math.floor(s.score / XP.runScoreDivisor)}
        missed={s.missed}
        previousBest={bestBefore}
        isRecord={s.score > bestBefore}
        onReplay={() => void start()}
      />
    )
  }

  const s = phase.state
  const card = s.cards[s.index % s.cards.length]!
  const urgent = msLeft <= URGENT_MS

  return (
    <div
      className={`-mx-4 -mt-3 flex min-h-[calc(var(--app-h)-7rem)] flex-col px-4 pt-3 transition-colors duration-[400ms] ${
        urgent ? 'bg-flame-soft/40' : ''
      }`}
    >
      <RushHud
        msLeft={msLeft}
        score={s.score}
        streak={s.streak}
        multiplier={multiplierFor(s.streak)}
        totalMs={GAME_SECONDS * 1000}
      />

      <div className="relative mt-4 flex-1">
        <RushCard key={s.index} card={card} onJudge={judge} shake={s.beat?.ok === false} />

        {s.beat ? (
          <div className="pointer-events-none absolute top-[120px] left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5">
            <XpFloat
              amount={0}
              tone={s.beat.ok ? 'ok' : 'err'}
              label={s.beat.ok ? `Correct ${s.beat.text}` : 'Wrong'}
            />
            {s.beat.sub ? (
              <span className="mt-11 rounded-full bg-card px-2.5 py-1.5 text-xs leading-[1.3] font-semibold whitespace-nowrap text-ink shadow-e1">
                {s.beat.sub}
              </span>
            ) : null}
          </div>
        ) : null}

        {s.levelUp ? (
          <div
            aria-hidden
            className="animate-burst pointer-events-none absolute top-[133px] left-1/2 z-20 flex flex-col items-center gap-1.5"
          >
            <span className="text-[64px] leading-none font-extrabold tracking-[-0.04em] text-flame">
              {s.levelUp}
            </span>
            <span className="text-xs leading-none font-extrabold tracking-[0.1em] text-flame uppercase">
              Multiplier up
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-none gap-3 pt-3 pb-2">
        <button
          type="button"
          onClick={() => judge(false)}
          className="flex min-h-15 flex-1 items-center justify-center gap-2 rounded-[20px] border-[1.5px] border-err bg-err-soft transition-transform duration-[90ms] active:scale-[0.96]"
        >
          <Icon name="cross" size={20} strokeWidth={3} className="text-err" />
          <span className="text-[15px] leading-none font-bold text-err">No match</span>
        </button>
        <button
          type="button"
          onClick={() => judge(true)}
          className="flex min-h-15 flex-1 items-center justify-center gap-2 rounded-[20px] border-[1.5px] border-ok bg-ok-soft transition-transform duration-[90ms] active:scale-[0.96]"
        >
          <Icon name="check" size={20} strokeWidth={3} className="text-ok" />
          <span className="text-[15px] leading-none font-bold text-ok">Match</span>
        </button>
      </div>

      <p aria-live="polite" className="sr-only">
        {s.beat ? (s.beat.ok ? `Correct, ${s.beat.text} points` : `Wrong. ${s.beat.sub}`) : ''}
      </p>
    </div>
  )
}
