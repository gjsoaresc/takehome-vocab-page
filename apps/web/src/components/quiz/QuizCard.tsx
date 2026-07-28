import type { QuizQuestionDto } from '@vocab/shared'
import { Chip } from '../ui/Chip'
import { Icon } from '../ui/Icon'

export interface Answered {
  question: QuizQuestionDto
  chosen: number
}

/** Ten segments: green for right, red for wrong, accent for the live one. */
function Segments({ answers, index, total }: { answers: Answered[]; index: number; total: number }) {
  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: total }, (_, i) => {
        const a = answers[i]
        const tone = a
          ? a.chosen === a.question.answer
            ? 'bg-ok'
            : 'bg-err'
          : i === index
            ? 'bg-accent'
            : 'bg-line'
        return <div key={i} className={`h-1.5 flex-1 rounded-[3px] transition-colors ${tone}`} />
      })}
    </div>
  )
}

interface QuizCardProps {
  question: QuizQuestionDto
  index: number
  total: number
  chosen: number | null
  combo: number
  answers: Answered[]
  onChoose: (optionIndex: number) => void
  onQuit: () => void
}

/**
 * One question. Answering locks every option and marks both the chosen one and
 * the correct one - each with an icon, a word and a colour, never colour alone.
 * The two also differ in fill: the answer fills solid, a wrong pick keeps its
 * outline, so they stay distinguishable with no colour at all.
 */
export function QuizCard({
  question,
  index,
  total,
  chosen,
  combo,
  answers,
  onChoose,
  onQuit,
}: QuizCardProps) {
  const locked = chosen !== null
  const w2d = question.direction === 'w2d'
  const correctCount = answers.filter((a) => a.chosen === a.question.answer).length

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onQuit}
          aria-label="Leave quiz"
          className="tap grid h-10 w-10 flex-none place-items-center rounded-[12px] border border-line bg-card text-muted"
        >
          <Icon name="close" size={18} strokeWidth={2.4} />
        </button>
        <div className="flex-1">
          <Segments answers={answers} index={index} total={total} />
          <div className="tabular mt-1.5 flex justify-between text-[11.5px] leading-none font-semibold">
            <span className="text-muted">
              Question {index + 1} of {total}
            </span>
            <span className="text-ok">{correctCount} correct</span>
          </div>
        </div>
        {combo >= 2 ? (
          <Chip tone="flame" icon="flame" iconFilled className="animate-pop tabular flex-none">
            x{combo}
          </Chip>
        ) : null}
      </div>

      <div className="flex min-h-[150px] flex-col justify-center rounded-xl border border-line bg-card p-4 shadow-e1">
        <p className="text-[11px] leading-none font-semibold tracking-[0.08em] text-muted uppercase">
          {w2d ? 'What does this mean?' : 'Which word means this?'}
        </p>
        <p
          className={`mt-2 font-bold tracking-[-0.02em] text-ink ${
            w2d ? 'text-[34px] leading-[38px]' : 'text-[22px] leading-[29px]'
          }`}
        >
          {question.prompt}
        </p>
        <p className="mt-1.5 text-[12.5px] leading-[17px] text-muted italic">
          {question.pos_relaxed
            ? 'Options may span parts of speech.'
            : 'All four options share a part of speech'}
        </p>
      </div>

      <div className="flex flex-col gap-2" role="group" aria-label="Answer options">
        {question.options.map((option, i) => {
          const isAnswer = i === question.answer
          const isChosen = i === chosen
          let box = 'border-line bg-card active:scale-[0.985]'
          let badge = 'bg-paper text-muted'
          let tag: string | null = null
          let tagTone = ''
          let mark: 'check' | 'cross' | null = null

          if (locked && isAnswer) {
            box = 'border-ok bg-ok-soft'
            badge = 'bg-ok text-on-ok'
            tag = isChosen ? 'Correct' : 'Answer'
            tagTone = 'text-ok'
            mark = 'check'
          } else if (locked && isChosen) {
            box = 'animate-nudge border-err bg-err-soft'
            badge = 'bg-err text-on-err'
            tag = 'Your pick'
            tagTone = 'text-err'
            mark = 'cross'
          } else if (locked) {
            box = 'border-line bg-card opacity-55'
          }

          return (
            <button
              key={i}
              type="button"
              disabled={locked}
              onClick={() => onChoose(i)}
              className={`flex min-h-14 w-full items-center gap-2.5 rounded-lg border-[1.5px] px-3.5 py-3 text-left transition-[background-color,border-color,transform] duration-[160ms] ${box}`}
            >
              <span
                className={`grid h-[26px] w-[26px] flex-none place-items-center rounded-[9px] font-mono text-[11.5px] font-bold ${badge}`}
              >
                {mark ? <Icon name={mark} size={16} strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={`flex-1 text-[14.5px] leading-[19px] text-ink ${
                  locked && (isAnswer || isChosen) ? 'font-semibold' : 'font-medium'
                }`}
              >
                {option}
              </span>
              {tag ? (
                <span className={`flex-none text-[11.5px] font-bold ${tagTone}`}>{tag}</span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
