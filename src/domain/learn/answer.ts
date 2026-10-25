import { z } from 'zod'
import { localDay } from '../day.ts'
import { DaySchema, IdSchema, TimestampSchema } from '../schemas.ts'

/**
 * One answer as handed to `recordAnswer`. An intent, not new values: the repository applies it
 * to whatever is stored, so two devices never overwrite each other's counts.
 * `answeredAt` also identifies the answer: sending the same record again changes nothing (#51).
 */
export const AnswerRecordSchema = z
  .object({
    termId: IdSchema,
    correct: z.boolean(),
    /** Reached level 2 without a mistake this session; the repository allows one step a day. */
    promote: z.boolean(),
    answeredAt: TimestampSchema,
    day: DaySchema,
  })
  .refine((answer) => answer.correct || !answer.promote, {
    error: 'A wrong answer cannot promote a term',
    path: ['promote'],
  })

export type AnswerRecord = z.output<typeof AnswerRecordSchema>

/** `answeredAt` and `day` come from the same instant, so they can never disagree. */
export function toAnswerRecord(
  termId: string,
  correct: boolean,
  promote: boolean,
  now: Date,
): AnswerRecord {
  return { termId, correct, promote, answeredAt: now.toISOString(), day: localDay(now) }
}
