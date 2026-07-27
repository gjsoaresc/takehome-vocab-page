// API contracts shared by @vocab/api and @vocab/web. Filled in with the API task.
export const MODES = ['learn', 'quiz', 'matching', 'game'] as const
export type Mode = (typeof MODES)[number]
