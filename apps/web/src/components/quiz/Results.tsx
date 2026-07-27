import type { QuizQuestionDto } from '@vocab/shared'
import { Link } from 'react-router-dom'

export interface AnsweredQuestion {
  question: QuizQuestionDto
  chosen: number
}

interface ResultsProps {
  answers: AnsweredQuestion[]
  onPlayAgain: () => void
}

/** Session results: score + missed words linking straight into Learn. */
export function Results({ answers, onPlayAgain }: ResultsProps) {
  const missed = answers.filter((a) => a.chosen !== a.question.answer)
  const score = answers.length - missed.length
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-line bg-card p-5 text-center">
        <p className="text-sm font-semibold text-muted">Session complete</p>
        <p className="mt-1 text-3xl font-bold">
          {score} / {answers.length}
        </p>
        <p className="mt-1 text-sm text-muted">
          {missed.length === 0
            ? 'Perfect run - nothing missed.'
            : `${missed.length} to review below.`}
        </p>
      </div>

      {missed.length > 0 ? (
        <div className="rounded-xl border border-line bg-card">
          <p className="border-b border-line px-4 py-3 font-semibold">Missed words</p>
          <ul>
            {missed.map(({ question }) => {
              const headword =
                question.direction === 'w2d' ? question.prompt : question.options[question.answer]!
              return (
                <li key={question.word_id} className="border-b border-line last:border-b-0">
                  <Link
                    to={`/learn?word=${question.word_id}`}
                    className="tap flex items-center justify-between px-4 py-3"
                  >
                    <span>
                      <span className="font-semibold">{headword}</span>
                      <span className="mt-0.5 block text-sm text-muted">
                        {question.direction === 'w2d'
                          ? question.options[question.answer]
                          : question.prompt}
                      </span>
                    </span>
                    <span aria-hidden className="text-muted">
                      &rsaquo;
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        {missed.length > 0 ? (
          <Link
            to={`/learn?word=${missed[0]!.question.word_id}`}
            className="tap flex items-center justify-center rounded-xl bg-accent px-5 font-semibold text-white active:bg-accent-strong"
          >
            Study missed words
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onPlayAgain}
          className="tap rounded-xl border border-line bg-card px-5 font-semibold active:border-accent"
        >
          Play again
        </button>
      </div>
    </div>
  )
}
