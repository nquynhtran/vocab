import { BOX_MAX, BOX_MIN, type TermProgress } from '../schemas.ts'
import type { AnswerRecord } from './answer.ts'

/**
 * The stored progress after `answer` (docs/learn-algorithm.md#recordanswer), or undefined when
 * this exact answer is already recorded (#51): `lastStudiedAt` equal to `answeredAt` means a
 * retry. Instants are compared, not strings, like the `timestamptz` comparison in SQL.
 * The same rule lives in `record_answer` (supabase/migrations); change both together.
 */
export function progressAfter(
  current: TermProgress | undefined,
  answer: AnswerRecord,
): TermProgress | undefined {
  if (
    current?.lastStudiedAt !== undefined &&
    Date.parse(current.lastStudiedAt) === Date.parse(answer.answeredAt)
  ) {
    return undefined
  }
  const base = current ?? {
    termId: answer.termId,
    box: BOX_MIN,
    correctCount: 0,
    wrongCount: 0,
  }
  if (!answer.correct) {
    return {
      ...base,
      box: BOX_MIN,
      wrongCount: base.wrongCount + 1,
      lastWrongAt: answer.answeredAt,
      lastStudiedAt: answer.answeredAt,
    }
  }
  // "Different day", not "later day": a clock set back must not block promotions forever (#50).
  const promoted = answer.promote && base.lastPromotedDay !== answer.day
  return {
    ...base,
    correctCount: base.correctCount + 1,
    lastStudiedAt: answer.answeredAt,
    ...(promoted && { box: Math.min(base.box + 1, BOX_MAX), lastPromotedDay: answer.day }),
  }
}
