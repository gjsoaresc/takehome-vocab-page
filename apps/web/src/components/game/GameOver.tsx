import type { GameCardDto } from '@vocab/shared'
import { Link } from 'react-router-dom'

interface GameOverProps {
  score: number
  bestStreak: number
  judged: number
  correct: number
  missed: GameCardDto[]
  onReplay: () => void
}

export function GameOver({ score, bestStreak, judged, correct, missed, onReplay }: GameOverProps) {
  const accuracy = judged === 0 ? 0 : Math.round((correct / judged) * 100)
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-line bg-card p-5 text-center">
        <p className="text-sm font-semibold text-muted">Time!</p>
        <p className="mt-1 text-4xl font-bold">{score}</p>
        <p className="mt-2 text-sm text-muted">
          {judged} judgments &middot; {accuracy}% right &middot; best streak {bestStreak}
        </p>
      </div>

      {missed.length > 0 ? (
        <div className="rounded-xl border border-line bg-card">
          <p className="border-b border-line px-4 py-3 font-semibold">Worth another look</p>
          <ul>
            {missed.slice(0, 8).map((card, i) => (
              <li key={`${card.word_id}-${i}`} className="border-b border-line last:border-b-0">
                <Link
                  to={`/learn?word=${card.word_id}`}
                  className="tap flex items-center justify-between px-4 py-3"
                >
                  <span className="font-semibold">{card.headword}</span>
                  <span aria-hidden className="text-muted">
                    &rsaquo;
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onReplay}
        className="tap rounded-xl bg-accent px-5 font-semibold text-white active:bg-accent-strong"
      >
        Play again
      </button>
    </div>
  )
}
