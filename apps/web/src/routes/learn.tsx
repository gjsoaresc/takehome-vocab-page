import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ProgressDto, WordDto, WordStatus } from '@vocab/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorState, ListSkeleton, useMinimumDuration } from '../components/States'
import { FilterChips, type PosFilter, type StatusFilter } from '../components/learn/FilterChips'
import { WordRow, type RowFeedback } from '../components/learn/WordRow'
import { XpFloat } from '../components/reward/XpFloat'
import { Icon } from '../components/ui/Icon'
import { ProgressRing } from '../components/ui/Progress'
import { useToast } from '../components/ui/Toast'
import { api } from '../lib/api'
import { sendEvent } from '../lib/events'
import { XP } from '../lib/rewards'
import { useUserId } from '../lib/user-context'

/** The design's session rhythm: a quiet celebration at each of these. */
const MILESTONES = [10, 25, 50]
const RING_TARGET = 25
/** Collapsed row height and the flex gap between rows, for offset maths. */
const ROW_ESTIMATE = 78
const ROW_GAP = 8

function statusFromProgress(progress: ProgressDto | null): WordStatus {
  if (!progress) return 'new'
  return progress.mastered_at ? 'mastered' : 'learning'
}

/** "next review in 9 days", from the server's own SM-2 answer. */
function intervalFrom(progress: ProgressDto | null): string {
  if (!progress) return 'saved to your deck'
  const ms = new Date(progress.due_at).getTime() - Date.now()
  const days = Math.round(ms / 86_400_000)
  if (days >= 1) return `next review in ${days} day${days === 1 ? '' : 's'}`
  const minutes = Math.max(1, Math.round(ms / 60_000))
  return minutes >= 60
    ? `next review in ${Math.round(minutes / 60)}h`
    : `next review in ${minutes}m`
}

export default function Learn() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  const toast = useToast()
  const wordsQuery = useQuery({
    queryKey: ['words', userId],
    queryFn: () => api.words(userId),
    staleTime: 5 * 60_000,
  })
  const showSkeleton = useMinimumDuration(wordsQuery.isLoading)

  const [query, setQuery] = useState('')
  const [pos, setPos] = useState<PosFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [openId, setOpenId] = useState<number | null>(null)
  const [revealedId, setRevealedId] = useState<number | null>(null)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [session, setSession] = useState(0)
  const [feedback, setFeedback] = useState<Record<number, RowFeedback>>({})
  const [float, setFloat] = useState<{ id: number; amount: number } | null>(null)
  const pendingFocus = useRef(false)
  const revealed = useRef(new Set<number>())
  const scrollRef = useRef<HTMLDivElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const words = useMemo(() => wordsQuery.data?.words ?? [], [wordsQuery.data])

  const counts = useMemo(() => {
    const c: Record<WordStatus, number> = { new: 0, learning: 0, mastered: 0 }
    for (const w of words) c[w.status]++
    return c
  }, [words])

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
    estimateSize: () => ROW_ESTIMATE,
    overscan: 8,
    gap: ROW_GAP,
  })

  // Deep link (?word=id from quiz results, Word Rush or Progress).
  const deepLinkId = Number(searchParams.get('word')) || null
  const deepLinkIndex = deepLinkId ? filtered.findIndex((w) => w.id === deepLinkId) : -1

  // The skeleton owns the viewport for its first 400ms, so the scroll element
  // does not exist yet; waiting for it is what makes a cold deep link land.
  useEffect(() => {
    if (deepLinkIndex < 0 || deepLinkId === null || showSkeleton) return
    const frame = requestAnimationFrame(() => {
      const el = scrollRef.current
      if (!el) return // still not mounted - keep the param and try again
      // Set the offset on the element rather than calling scrollToIndex: that
      // helper no-ops until the virtualizer has measured its scroll element,
      // which on a cold load never happens in time. Unmeasured rows fall back
      // to the estimate the offset is built from anyway.
      const [offset] = virtualizer.getOffsetForIndex(deepLinkIndex, 'center') ?? []
      el.scrollTop = offset ?? deepLinkIndex * (ROW_ESTIMATE + ROW_GAP)
      setOpenId(deepLinkId)
      setFocusedIndex(deepLinkIndex)
      setSearchParams({}, { replace: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [deepLinkIndex, deepLinkId, showSkeleton, setSearchParams, virtualizer])

  function toggle(word: WordDto, index: number) {
    setFocusedIndex(index)
    const opening = openId !== word.id
    setOpenId(opening ? word.id : null)
    if (!opening) setRevealedId(null)
  }

  const reveal = useCallback(
    (word: WordDto) => {
      setRevealedId(word.id)
      if (revealed.current.has(word.id)) return
      revealed.current.add(word.id)
      void sendEvent({ user_id: userId, mode: 'learn', type: 'revealed', word_id: word.id })
    },
    [userId],
  )

  const rate = useCallback(
    async (word: WordDto, rating: number) => {
      setOpenId(null)
      setRevealedId(null)
      setFloat({ id: word.id, amount: XP.perRating })
      setTimeout(() => setFloat(null), 700)

      const next = session + 1
      setSession(next)
      if (MILESTONES.includes(next)) {
        toast({
          title: `${next} words rated this session`,
          body: next === 50 ? 'That is a serious sitting.' : 'Keep the run going.',
          icon: 'star',
          tone: 'gold',
        })
      }

      const result = await sendEvent({
        user_id: userId,
        mode: 'learn',
        type: 'rated',
        word_id: word.id,
        rating,
      })

      setFeedback((f) => ({
        ...f,
        [word.id]: { interval: intervalFrom(result.progress), queued: result.queued },
      }))

      // Server truth: reflect the returned progress into the cached list. A
      // queued write has no server answer yet, so the row keeps its old status
      // rather than being downgraded to "new".
      if (result.queued) return
      queryClient.setQueryData<{ words: WordDto[] }>(['words', userId], (old) =>
        old
          ? {
              words: old.words.map((w) =>
                w.id === word.id
                  ? { ...w, status: statusFromProgress(result.progress), due_at: result.progress?.due_at ?? w.due_at }
                  : w,
              ),
            }
          : old,
      )
    },
    [queryClient, session, toast, userId],
  )

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
    const openWord = openId === null ? undefined : filtered.find((w) => w.id === openId)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.min(
        filtered.length - 1,
        Math.max(0, focusedIndex + (e.key === 'ArrowDown' ? 1 : -1)),
      )
      pendingFocus.current = true
      setFocusedIndex(next)
      virtualizer.scrollToIndex(next)
    } else if (e.key === 'Escape' && openId !== null) {
      setOpenId(null)
      setRevealedId(null)
    } else if (e.key === 'Enter' && openWord && revealedId !== openWord.id) {
      e.preventDefault()
      reveal(openWord)
    } else if (openWord && revealedId === openWord.id && ['1', '2', '3', '4'].includes(e.key)) {
      const rating = { 1: 1, 2: 3, 3: 4, 4: 5 }[e.key as '1' | '2' | '3' | '4']
      void rate(openWord, rating)
    }
  }

  function clearFilters() {
    setQuery('')
    setPos('all')
    setStatus('all')
  }

  if (showSkeleton) return <ListSkeleton />
  if (wordsQuery.isError)
    return (
      <ErrorState
        title="Couldn't load your words"
        message="The request timed out. Your ratings are safe on this device - nothing here is lost."
        onRetry={() => void wordsQuery.refetch()}
      />
    )

  return (
    <div className="flex h-[calc(100dvh-9.5rem)] flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <h1 className="text-xl leading-7 font-bold tracking-[-0.02em] text-ink">Words</h1>
        <span className="tabular ml-auto text-[11.5px] text-muted">
          {filtered.length.toLocaleString('en-US')} shown
        </span>
        <ProgressRing
          value={Math.min(1, session / RING_TARGET)}
          size={34}
          stroke={4}
          tone="accent"
          animate={false}
          label={`${session} rated this session`}
        >
          <span className="tabular text-[11px] font-bold text-ink">{session}</span>
        </ProgressRing>
      </div>

      <div className="relative">
        <Icon
          name="search"
          size={16}
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${words.length.toLocaleString('en-US')} words`}
          aria-label="Search words and definitions"
          className="tap w-full rounded-[14px] border border-line bg-card pr-4 pl-10 text-base text-ink placeholder:text-muted"
        />
      </div>

      <FilterChips
        pos={pos}
        status={status}
        counts={counts}
        total={words.length}
        onPos={setPos}
        onStatus={setStatus}
        onReset={clearFilters}
      />

      {filtered.length === 0 ? (
        <EmptyState
          where="learn - search"
          icon="search"
          title={query ? `No match for "${query}"` : 'Nothing matches those filters'}
          hint={
            pos !== 'all' || status !== 'all'
              ? 'Filters are also narrowing this list, so there may be results hiding behind them.'
              : 'Try a shorter word stem.'
          }
          actionLabel="Clear search and filters"
          onAction={clearFilters}
        />
      ) : (
        <div ref={scrollRef} onKeyDown={onKeyDown} className="-mx-1 flex-1 overflow-y-auto px-1">
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
                  <div className="relative">
                    <WordRow
                      word={word}
                      rowIndex={item.index}
                      open={openId === word.id}
                      revealed={revealedId === word.id}
                      focused={focusedIndex === item.index}
                      feedback={feedback[word.id]}
                      onToggle={() => toggle(word, item.index)}
                      onReveal={() => reveal(word)}
                      onRate={(rating) => void rate(word, rating)}
                    />
                    {float?.id === word.id ? <XpFloat amount={float.amount} /> : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
