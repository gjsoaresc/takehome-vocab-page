import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import { z } from 'zod'

/** zValidator with the project's error envelope. */
export function validate<T extends z.ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: { code: 'invalid_request', message: z.prettifyError(result.error) } },
        400,
      )
    }
  })
}

export const userIdQuery = z.object({ user_id: z.uuid() })

/** "1,2,3" -> [1, 2, 3]; empty/absent -> []. */
export const excludeList = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? '')
      .split(',')
      .filter(Boolean)
      .map((s) => Number.parseInt(s, 10))
      .filter((n) => Number.isInteger(n) && n > 0),
  )
