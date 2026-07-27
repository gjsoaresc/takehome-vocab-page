import type { QuizQuestionDto } from '@vocab/shared'

interface QuizCardProps {
  question: QuizQuestionDto
  index: number
  total: number
  chosen: number | null
  onChoose: (optionIndex: number) => void
}

/** One question: prompt + four options with icon-and-text feedback. */
export function QuizCard({ question, index, total, chosen, onChoose }: QuizCardProps) {
  const answered = chosen !== null
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-semibold text-muted">
        Question {index + 1} of {total}
      </p>
      <div className="rounded-xl border border-line bg-card p-5">
        <p className="text-xs font-semibold text-muted">
          {question.direction === 'w2d' ? 'Which definition matches' : 'Which word matches'}
        </p>
        <p className={question.direction === 'w2d' ? 'mt-1 text-2xl font-bold' : 'mt-2 text-base'}>
          {question.prompt}
        </p>
        {question.pos_relaxed ? (
          <p className="mt-2 text-xs text-muted">Options may span parts of speech.</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2" role="group" aria-label="Answer options">
        {question.options.map((option, i) => {
          const isAnswer = i === question.answer
          const isChosen = i === chosen
          let style = 'border-line bg-card active:border-accent'
          let mark: string | null = null
          if (answered && isAnswer) {
            style = 'border-ok bg-ok-soft'
            mark = '✓'
          } else if (answered && isChosen) {
            style = 'border-err bg-err-soft'
            mark = '✗'
          } else if (answered) {
            style = 'border-line bg-card opacity-60'
          }
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => onChoose(i)}
              className={`tap rounded-xl border px-4 py-3 text-left text-sm ${style}`}
            >
              <span className="flex items-start justify-between gap-2">
                <span>{option}</span>
                {mark ? (
                  <span className="shrink-0 text-sm font-bold">
                    {mark} {isAnswer ? 'Correct' : 'Not quite'}
                  </span>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
      <p aria-live="polite" className="sr-only">
        {answered ? (chosen === question.answer ? 'Correct' : 'Not quite') : ''}
      </p>
    </div>
  )
}
