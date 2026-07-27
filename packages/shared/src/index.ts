import { z } from 'zod'

// API contracts shared by @vocab/api (validation) and @vocab/web (types).

export const MODES = ['learn', 'quiz', 'matching', 'game'] as const
export type Mode = (typeof MODES)[number]

export const EVENT_TYPES = ['revealed', 'rated', 'graded', 'matched', 'game_finished'] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const POS_VALUES = ['v', 'n', 'adj', 'adv'] as const
export type Pos = (typeof POS_VALUES)[number]

/** Body of POST /api/events. event_id is the client-generated idempotency key. */
export const eventInputSchema = z.object({
  event_id: z.uuid(),
  user_id: z.uuid(),
  mode: z.enum(MODES),
  type: z.enum(EVENT_TYPES),
  word_id: z.number().int().positive().nullish(),
  sense_id: z.number().int().positive().nullish(),
  correct: z.boolean().nullish(),
  rating: z.number().int().min(0).max(5).nullish(),
  payload: z.record(z.string(), z.unknown()).optional(),
})
export type EventInput = z.infer<typeof eventInputSchema>

export interface SenseDto {
  senseNo: number
  pos: Pos
  definition: string
  example: string | null
}

export type WordStatus = 'new' | 'learning' | 'mastered'

export interface WordDto {
  id: number
  headword: string
  senses: SenseDto[]
  status: WordStatus
  due_at: string | null
}

export interface ProgressDto {
  user_id: string
  word_id: number
  ease: string
  interval_days: number
  repetitions: number
  due_at: string
  mastered_at: string | null
  correct_count: number
  miss_count: number
}

export interface EventResult {
  duplicate: boolean
  progress: ProgressDto | null
}

export interface ReviewItemDto {
  word_id: number
  headword: string
  senses: SenseDto[]
  reason: 'due' | 'new'
  due_at: string | null
}

export type QuizDirection = 'w2d' | 'd2w'

export interface QuizQuestionDto {
  word_id: number
  sense_id: number
  direction: QuizDirection
  prompt: string
  options: string[]
  answer: number
  pos_relaxed: boolean
}

export interface MatchingPairDto {
  word_id: number
  sense_id: number
  headword: string
  definition: string
}

export interface GameCardDto {
  word_id: number
  sense_id: number
  headword: string
  definition: string
  is_match: boolean
}

export interface StatsDto {
  mastery_over_time: Array<{ day: string; mastered: number; reviews: number; correct: number }>
  streak: number
  hardest: Array<{
    word_id: number
    headword: string
    attempts: number
    misses: number
    miss_rate: number
  }>
  modes: Array<{ mode: Mode; attempts: number; correct: number; accuracy: number }>
  totals: { words_seen: number; words_mastered: number }
}
