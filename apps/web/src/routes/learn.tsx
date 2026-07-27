import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Pos, ProgressDto, WordDto, WordStatus } from '@vocab/shared'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { WordRow } from '../components/learn/WordRow'
import { api } from '../lib/api'
import { sendEvent } from '../lib/events'
import { useUserId } from '../lib/user-context'

const POS_FILTERS: Array<{ value: Pos | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'v', label: 'Verbs' },
  { value: 'n', label: 'Nouns' },
  { value: 'adj', label: 'Adjectives' },
  { value: 'adv', label: 'Adverbs' },
]

const STATUS_FILTERS: Array<{ value: WordStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Any status' },
  { value: 'new', label: 'New' },
  { value: 'learning', label: 'Learning' },
  { value: 'mastered', label: 'Mastered' },
]

function statusFromProgress(progress: ProgressDto | null): WordStatus {
  if (!progress) return 'new'
  return progress.mastered_at ? 'mastered' : 'learning'
}

export default function Learn() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  const wordsQuery = useQuery({
    queryKey: ['words', userId],
    queryFn: () => api.words(userId),
    staleTime: 5 * 60_000,
  })

  const [query, setQuery] = useState('')
  const [pos, setPos] = useState<Pos | 'all'>('all')
  const [status, setStatus] = useState<WordStatus | 'all'>('all')
  const [openId, setOpenId] = useState<number | null>(null)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const pendingFocus = useRef(false)
  const revealed = useRef(new Set<number>())
  const scrollRef = useRef<HTMLDivElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const words = useMemo(() => wordsQuery.data?.words ?? [], [wordsQuery.data])

  // Client-side search over the cached list: ~1k rows, well under 100ms.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return words.filter((w) => {
      if (pos !== 'all' && !w.senses.some((s) => s.pos === pos)) return false
      if (status !== 'all' && w.status !== status) return false
      if (!q) return true
      return (
        w.headword.toLowerCase().includes(q) ||
        w.senses.some((s) => s.definition.toLowerCase().includes(q))
      )
    })
  }, [words, query, pos, status])

  // eslint-disable-next-line react-hooks/incompatible-library -- React Compiler skips this component; TanStack Virtual manages its own subscriptions.
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 64,
    overscan: 8,
  })

  // Deep link (?word=id from quiz results): scroll to and reveal that word.
  useEffect(() => {
    const target = Number(searchParams.get('word'))
    if (!target || words.length === 0) return
    const index = filtered.findIndex((w) => w.id === target)
    if (index >= 0) {
      virtualizer.scrollToIndex(index, { align: 'center' })
      setOpenId(target)
      setFocusedIndex(index)
    }
    setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, searchParams])

  function toggle(word: WordDto, index: number) {
    setFocusedIndex(index)
    const opening = openId !== word.id
    setOpenId(opening ? word.id : null)
    if (opening && !revealed.current.has(word.id)) {
      revealed.current.add(word.id)
      void sendEvent({ user_id: userId, mode: 'learn', type: 'revealed', word_id: word.id })
    }
  }

  async function rate(word: WordDto, rating: number) {
    setOpenId(null)
    const result = await sendEvent({
      user_id: userId,
      mode: 'learn',
      type: 'rated',
      word_id: word.id,
      rating,
    })
    // Server truth: reflect the returned progress into the cached list.
    queryClient.setQueryData<{ words: WordDto[] }>(['words', userId], (old) =>
      old
        ? {
            words: old.words.map((w) =>
              w.id === word.id ? { ...w, status: statusFromProgress(result.progress) } : w,
            ),
          }
        : old,
    )
  }

  // Keyboard focus follows focusedIndex after the re-render (an immediate
  // rAF can fire before React commits the new tabIndex).
  useEffect(() => {
    if (!pendingFocus.current) return
    pendingFocus.current = false
    scrollRef.current
      ?.querySelector<HTMLButtonElement>(`[data-word-row="${focusedIndex}"]`)
      ?.focus()
  }, [focusedIndex])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.min(
        filtered.length - 1,
        Math.max(0, focusedIndex + (e.key === 'ArrowDown' ? 1 : -1)),
      )
      pendingFocus.current = true
      setFocusedIndex(next)
      virtualizer.scrollToIndex(next)
    } else if (openId !== null && ['1', '2', '3', '4'].includes(e.key)) {
      const word = filtered.find((w) => w.id === openId)
      const rating = { 1: 1, 2: 3, 3: 4, 4: 5 }[e.key as '1' | '2' | '3' | '4']
      if (word) void rate(word, rating)
    }
  }

  if (wordsQuery.isLoading) return <LoadingState label="Loading all 1,000 words" />
  if (wordsQuery.isError)
    return (
      <ErrorState message="Could not load the word list." onRetry={() => wordsQuery.refetch()} />
    )

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] flex-col gap-3">
      <h1 className="sr-only">Learn</h1>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${words.length} words`}
        aria-label="Search words and definitions"
        className="tap w-full rounded-xl border border-line bg-card px-4 text-base"
      />
      <div className="flex gap-2" role="group" aria-label="Filters">
        <select
          value={pos}
          onChange={(e) => setPos(e.target.value as Pos | 'all')}
          aria-label="Filter by part of speech"
          className="tap rounded-lg border border-line bg-card px-2 text-sm"
        >
          {POS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as WordStatus | 'all')}
          aria-label="Filter by status"
          className="tap rounded-lg border border-line bg-card px-2 text-sm"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <span className="ml-auto self-center whitespace-nowrap text-xs text-muted">
          {filtered.length} shown
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No words match"
          hint="Try a different search or clear the filters."
          action={
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setPos('all')
                setStatus('all')
              }}
              className="tap rounded-lg bg-accent px-5 font-medium text-white"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <div
          ref={scrollRef}
          onKeyDown={onKeyDown}
          className="flex-1 overflow-y-auto rounded-xl border border-line bg-card px-3"
        >
          <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const word = filtered[item.index]!
              return (
                <div
                  key={word.id}
                  ref={virtualizer.measureElement}
                  data-index={item.index}
                  className="absolute inset-x-0 top-0"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <WordRow
                    word={word}
                    rowIndex={item.index}
                    open={openId === word.id}
                    focused={focusedIndex === item.index}
                    onToggle={() => toggle(word, item.index)}
                    onRate={(rating) => void rate(word, rating)}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
