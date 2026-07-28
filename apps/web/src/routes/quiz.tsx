import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { QuizDirection, QuizQuestionDto, StatsDto } from '@vocab/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { EmptyState, ErrorState, QuizSkeleton } from '../components/States'
import { FeedbackBar } from '../components/quiz/FeedbackBar'
import { QuizCard, type Answered } from '../components/quiz/QuizCard'
import { Results } from '../components/quiz/Results'
import { Icon, type IconName } from '../components/ui/Icon'
import { api } from '../lib/api'
import { useCelebrate } from '../lib/celebrate'
import { sendEvent } from '../lib/events'
import { getBestRun, getStoredGoal, getXpFloor, rememberXp } from '../lib/reward-store'
import { XP, deriveRewards, sessionXp, type Badge } from '../lib/rewards'
import { useUserId } from '../lib/user-context'

const SESSION_SIZE = 10
/** A combo of three or more is worth a little extra, per the design. */
const COMBO_BONUS = 5

type Pick = QuizDirection | 'mixed'

const DIRECTIONS: Array<{
  value: Pick
  title: string
  sub: string
  example: string
  icon: IconName
  tone: string
  tile: string
}> = [
  {
    value: 'w2d',
    title: 'Word to definition',
    sub: 'See the word, choose what it means',
    example: 'laconic -> "using very few words"',
    icon: 'wordToDef',
    tone: 'text-accent',
    tile: 'bg-accent-soft text-accent',
  },
  {
    value: 'd2w',
    title: 'Definition to word',
    sub: 'See the meaning, find the word',
    example: '"using very few words" -> laconic',
    icon: 'defToWord',
    tone: 'text-xp',
    tile: 'bg-xp-soft text-xp',
  },
  {
    value: 'mixed',
    title: 'Mixed',
    sub: 'Both directions, alternating - hardest',
    example: '5 each way, shuffled',
    icon: 'swap',
    tone: 'text-flame',
    tile: 'bg-flame-soft text-flame',
  },
]

type Phase =
  | { name: 'pick' }
  | { name: 'loading' }
  | { name: 'error'; message: string }
  | { name: 'empty' }
  | { name: 'playing'; questions: QuizQuestionDto[]; index: number; chosen: number | null }
  | { name: 'done' }

/** Mixed interleaves the two halves so the direction alternates. */
function interleave(a: QuizQuestionDto[], b: QuizQuestionDto[]): QuizQuestionDto[] {
  const out: QuizQuestionDto[] = []
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) out.push(a[i]!)
    if (b[i]) out.push(b[i]!)
  }
  return out.slice(0, SESSION_SIZE)
}

export default function Quiz() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  const { reportBadges } = useCelebrate()
  const statsQuery = useQuery({ queryKey: ['stats', userId], queryFn: () => api.stats(userId) })

  const [phase, setPhase] = useState<Phase>({ name: 'pick' })
  const [pick, setPick] = useState<Pick>('w2d')
  const [answers, setAnswers] = useState<Answered[]>([])
  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [unlocked, setUnlocked] = useState<Badge[]>([])
  // No word repeats while the user keeps playing: asked ids accumulate
  // across rounds and are excluded server-side.
  const askedIds = useRef(new Set<number>())

  const start = useCallback(
    async (choice: Pick) => {
      setPick(choice)
      setAnswers([])
      setCombo(0)
      setBestCombo(0)
      setUnlocked([])
      setPhase({ name: 'loading' })
      try {
        const exclude = [...askedIds.current]
        let questions: QuizQuestionDto[]
        if (choice === 'mixed') {
          const half = Math.ceil(SESSION_SIZE / 2)
          const [w2d, d2w] = await Promise.all([
            api.quizNext(userId, 'w2d', half, exclude),
            api.quizNext(userId, 'd2w', half, exclude),
          ])
          // Both halves are drawn from the same exclusion set, so drop any
          // word that happened to land in both.
          const seen = new Set<number>()
          questions = interleave(w2d.questions, d2w.questions).filter((q) =>
            seen.has(q.word_id) ? false : (seen.add(q.word_id), true),
          )
        } else {
          questions = (await api.quizNext(userId, choice, SESSION_SIZE, exclude)).questions
        }
        if (questions.length === 0) {
          setPhase({ name: 'empty' })
          return
        }
        for (const q of questions) askedIds.current.add(q.word_id)
        setPhase({ name: 'playing', questions, index: 0, chosen: null })
      } catch (err) {
        setPhase({ name: 'error', message: (err as Error).message })
      }
    },
    [userId],
  )

  function choose(optionIndex: number) {
    if (phase.name !== 'playing' || phase.chosen !== null) return
    const question = phase.questions[phase.index]!
    const correct = optionIndex === question.answer
    setPhase({ ...phase, chosen: optionIndex })
    setAnswers((prev) => [...prev, { question, chosen: optionIndex }])
    const nextCombo = correct ? combo + 1 : 0
    setCombo(nextCombo)
    setBestCombo((b) => Math.max(b, nextCombo))
    void sendEvent({
      user_id: userId,
      mode: 'quiz',
      type: 'graded',
      word_id: question.word_id,
      sense_id: question.sense_id,
      correct,
      payload: { direction: question.direction },
    })
  }

  const advance = useCallback(() => {
    setPhase((current) => {
      if (current.name !== 'playing') return current
      return current.index + 1 < current.questions.length
        ? { ...current, index: current.index + 1, chosen: null }
        : { name: 'done' }
    })
  }, [])

  // The session's writes have landed. Refetch the reward picture once, then
  // let the celebration layer decide whether anything earned a sheet - using
  // the refreshed payload, not whatever was cached when the round started.
  useEffect(() => {
    if (phase.name !== 'done') return
    let cancelled = false
    void queryClient
      .invalidateQueries({ queryKey: ['stats', userId] })
      .then(() => queryClient.getQueryData<StatsDto>(['stats', userId]))
      .then((fresh) => {
        if (cancelled || !fresh) return
        const reward = deriveRewards(fresh, {
          xpFloor: getXpFloor(),
          storedGoal: getStoredGoal(),
          bestRunScore: getBestRun(),
        })
        rememberXp(reward.xp)
        setUnlocked(reportBadges(reward.badges))
      })
    return () => {
      cancelled = true
    }
  }, [phase.name, queryClient, userId, reportBadges])

  // Enter or Space moves past the feedback bar, matching the design's
  // keyboard hints; 1-4 pick an option.
  useEffect(() => {
    if (phase.name !== 'playing') return
    const onKey = (e: KeyboardEvent) => {
      if (phase.chosen === null && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault()
        choose(Number(e.key) - 1)
      } else if (phase.chosen !== null && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (phase.name === 'pick') {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-[28px] leading-8 font-bold tracking-[-0.025em] text-ink">
            Which way
            <br />
            do you want it?
          </h1>
          <p className="mt-2 text-sm leading-5 text-muted">
            {SESSION_SIZE} questions - about three minutes
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {DIRECTIONS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => void start(d.value)}
              className="w-full rounded-xl border border-line bg-card p-4 text-left transition-transform duration-[90ms] ease-standard active:scale-[0.985]"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`grid h-[46px] w-[46px] flex-none place-items-center rounded-[15px] ${d.tile}`}
                >
                  <Icon name={d.icon} size={24} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[18px] leading-[23px] font-bold tracking-[-0.01em] text-ink">
                    {d.title}
                  </span>
                  <span className="block text-[13px] leading-[18px] text-muted">{d.sub}</span>
                </span>
                <Icon name="chevronRight" size={20} strokeWidth={2.2} className="text-ink" />
              </div>
              <div className="mt-3 rounded-[14px] border border-line bg-paper px-3 py-2.5">
                <div className="text-[11px] leading-none tracking-[0.06em] text-muted uppercase">
                  Looks like
                </div>
                <div className="mt-1 text-[13.5px] leading-[19px] font-semibold text-ink">
                  {d.example}
                </div>
              </div>
            </button>
          ))}
        </div>

        <p className="flex items-start gap-2.5 text-xs leading-[17px] text-muted">
          <Icon name="info" size={16} className="mt-px flex-none" />
          Distractors always share the part of speech, so guessing by grammar will not work.
        </p>
      </div>
    )
  }

  if (phase.name === 'loading') return <QuizSkeleton />
  if (phase.name === 'error')
    return (
      <ErrorState
        title="Quiz couldn't start"
        message="We couldn't fetch this round's questions. Nothing was counted, and your streak is untouched."
        retryLabel="Retry round"
        onRetry={() => void start(pick)}
        altLabel="Pick another mode"
        onAlt={() => setPhase({ name: 'pick' })}
      />
    )
  if (phase.name === 'empty')
    return (
      <EmptyState
        where="quiz"
        icon="quiz"
        title="No words left to quiz"
        hint="You have been asked every word this session. Impressive."
        actionLabel="Start over"
        onAction={() => {
          askedIds.current.clear()
          setPhase({ name: 'pick' })
        }}
      />
    )

  if (phase.name === 'done') {
    const correctCount = answers.filter((a) => a.chosen === a.question.answer).length
    return (
      <Results
        answers={answers}
        bestCombo={bestCombo}
        xpEarned={sessionXp({ correct: correctCount }) + (bestCombo >= 3 ? COMBO_BONUS : 0)}
        streak={statsQuery.data?.streak ?? 0}
        unlocked={unlocked}
        onPlayAgain={() => void start(pick)}
      />
    )
  }

  const question = phase.questions[phase.index]!
  const correct = phase.chosen === question.answer
  const headword =
    question.direction === 'w2d' ? question.prompt : question.options[question.answer]!
  const definition =
    question.direction === 'w2d' ? question.options[question.answer]! : question.prompt

  return (
    <>
      <div className={phase.chosen === null ? '' : 'pb-40'}>
        <QuizCard
          question={question}
          index={phase.index}
          total={phase.questions.length}
          chosen={phase.chosen}
          combo={combo}
          answers={answers}
          onChoose={choose}
          onQuit={() => setPhase({ name: 'pick' })}
        />
      </div>
      {phase.chosen !== null ? (
        <FeedbackBar
          correct={correct}
          headword={headword}
          definition={definition}
          combo={combo}
          xpGain={XP.perCorrect + (combo >= 3 ? COMBO_BONUS : 0)}
          isLast={phase.index + 1 >= phase.questions.length}
          onNext={advance}
        />
      ) : null}
    </>
  )
}
