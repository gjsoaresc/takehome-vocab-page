import type { QuizDirection, QuizQuestionDto } from '@vocab/shared'
import { useRef, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { QuizCard } from '../components/quiz/QuizCard'
import { Results, type AnsweredQuestion } from '../components/quiz/Results'
import { api } from '../lib/api'
import { sendEvent } from '../lib/events'
import { useUserId } from '../lib/user-context'

const SESSION_SIZE = 10

type Phase =
  | { name: 'pick' }
  | { name: 'loading' }
  | { name: 'error'; message: string }
  | { name: 'empty' }
  | { name: 'playing'; questions: QuizQuestionDto[]; index: number; chosen: number | null }
  | { name: 'done' }

export default function Quiz() {
  const userId = useUserId()
  const [phase, setPhase] = useState<Phase>({ name: 'pick' })
  const [direction, setDirection] = useState<QuizDirection>('w2d')
  const [answers, setAnswers] = useState<AnsweredQuestion[]>([])
  // No word repeats while the user keeps playing: asked ids accumulate
  // across rounds and are excluded server-side.
  const askedIds = useRef(new Set<number>())
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function start(dir: QuizDirection) {
    setDirection(dir)
    setAnswers([])
    setPhase({ name: 'loading' })
    try {
      const { questions } = await api.quizNext(userId, dir, SESSION_SIZE, [...askedIds.current])
      if (questions.length === 0) {
        setPhase({ name: 'empty' })
        return
      }
      for (const q of questions) askedIds.current.add(q.word_id)
      setPhase({ name: 'playing', questions, index: 0, chosen: null })
    } catch (err) {
      setPhase({ name: 'error', message: (err as Error).message })
    }
  }

  function choose(optionIndex: number) {
    if (phase.name !== 'playing' || phase.chosen !== null) return
    const question = phase.questions[phase.index]!
    const correct = optionIndex === question.answer
    setPhase({ ...phase, chosen: optionIndex })
    setAnswers((prev) => [...prev, { question, chosen: optionIndex }])
    void sendEvent({
      user_id: userId,
      mode: 'quiz',
      type: 'graded',
      word_id: question.word_id,
      sense_id: question.sense_id,
      correct,
      payload: { direction: question.direction },
    })
    advanceTimer.current = setTimeout(
      () => {
        setPhase((current) => {
          if (current.name !== 'playing') return current
          return current.index + 1 < current.questions.length
            ? { ...current, index: current.index + 1, chosen: null }
            : { name: 'done' }
        })
      },
      correct ? 900 : 1700,
    )
  }

  if (phase.name === 'pick') {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Quiz</h1>
        <p className="text-sm text-muted">
          {SESSION_SIZE} questions, four options each. Pick a direction:
        </p>
        <button
          type="button"
          onClick={() => void start('w2d')}
          className="tap rounded-xl border border-line bg-card p-4 text-left active:border-accent"
        >
          <p className="font-bold">Word &rarr; Definition</p>
          <p className="text-sm text-muted">See the word, choose what it means</p>
        </button>
        <button
          type="button"
          onClick={() => void start('d2w')}
          className="tap rounded-xl border border-line bg-card p-4 text-left active:border-accent"
        >
          <p className="font-bold">Definition &rarr; Word</p>
          <p className="text-sm text-muted">See the meaning, choose the word</p>
        </button>
      </div>
    )
  }

  if (phase.name === 'loading') return <LoadingState label="Building your quiz" />
  if (phase.name === 'error')
    return <ErrorState message={phase.message} onRetry={() => void start(direction)} />
  if (phase.name === 'empty')
    return (
      <EmptyState
        title="No words left to quiz"
        hint="You have been asked every word this session. Impressive."
        action={
          <button
            type="button"
            onClick={() => {
              askedIds.current.clear()
              setPhase({ name: 'pick' })
            }}
            className="tap rounded-lg bg-accent px-5 font-medium text-white"
          >
            Start over
          </button>
        }
      />
    )

  if (phase.name === 'done') return <Results answers={answers} onPlayAgain={() => void start(direction)} />

  const question = phase.questions[phase.index]!
  return (
    <QuizCard
      question={question}
      index={phase.index}
      total={phase.questions.length}
      chosen={phase.chosen}
      onChoose={choose}
    />
  )
}
