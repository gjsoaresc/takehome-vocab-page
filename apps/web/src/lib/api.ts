import type {
  EventResult,
  GameCardDto,
  MatchingPairDto,
  QuizDirection,
  QuizQuestionDto,
  ReviewItemDto,
  StatsDto,
  WordDto,
} from '@vocab/shared'

// Same-origin '/api': the vite dev server and the nginx container both proxy
// it to the api service. Progress lives ONLY behind these calls.
const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { code?: string; message?: string }
    } | null
    const err = new Error(body?.error?.message ?? `HTTP ${res.status}`)
    ;(err as Error & { status: number; code?: string }).status = res.status
    ;(err as Error & { status: number; code?: string }).code = body?.error?.code
    throw err
  }
  return (await res.json()) as T
}

export const api = {
  createUser: () => request<{ id: string }>('/users', { method: 'POST' }),
  words: (userId: string) => request<{ words: WordDto[] }>(`/words?user_id=${userId}`),
  reviewNext: (userId: string, limit = 10) =>
    request<{ items: ReviewItemDto[] }>(`/review/next?user_id=${userId}&limit=${limit}`),
  quizNext: (userId: string, direction: QuizDirection, count: number, exclude: number[]) =>
    request<{ questions: QuizQuestionDto[] }>(
      `/quiz/next?user_id=${userId}&direction=${direction}&count=${count}&exclude=${exclude.join(',')}`,
    ),
  matchingNext: (userId: string) =>
    request<{ pairs: MatchingPairDto[] }>(`/matching/next?user_id=${userId}`),
  gameNext: (userId: string, count = 40) =>
    request<{ cards: GameCardDto[] }>(`/game/next?user_id=${userId}&count=${count}`),
  stats: (userId: string) => request<StatsDto>(`/stats?user_id=${userId}`),
  postEvent: (body: Record<string, unknown>) =>
    request<EventResult>('/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
}
