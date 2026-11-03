import { z } from 'zod'
import { IdSchema, TimestampSchema, type Term, type TermProgress } from '../schemas.ts'
import {
  DONE_LEVEL,
  isSessionOver,
  startingLevel,
  startRound,
  type LearnSession,
  type SessionTerm,
} from './session.ts'

/**
 * A session stopped halfway, as kept on this device (docs/learn-algorithm.md#học-tiếp-sau-khi-dừng-58).
 * Ids and state only: the words are read again, so edits made since show up.
 * Untrusted (an old version, edited by hand): anything inconsistent means no saved session.
 */
const SavedSessionShape = z.object({
  version: z.literal(1),
  /** Shown as "last studied 5 days ago" (#62). */
  savedAt: TimestampSchema,
  round: z.number().int().min(1),
  queue: z.array(IdSchema),
  answers: z.array(
    z.object({ termId: IdSchema, correct: z.boolean(), round: z.number().int().min(1) }),
  ),
  terms: z.array(
    z.object({
      termId: IdSchema,
      level: z.union([z.literal(0), z.literal(1), z.literal(2)]),
      missed: z.boolean(),
    }),
  ),
})

/** What `applyAnswer` and `startRound` can produce, and nothing else. */
function isConsistent(saved: z.output<typeof SavedSessionShape>): boolean {
  const levels = new Map(saved.terms.map((entry) => [entry.termId, entry.level]))
  const notDone = (id: string) => {
    const level = levels.get(id)
    return level !== undefined && level < DONE_LEVEL
  }
  return (
    levels.size === saved.terms.length &&
    new Set(saved.queue).size === saved.queue.length &&
    saved.queue.every(notDone) &&
    saved.answers.every((answer) => levels.has(answer.termId) && answer.round <= saved.round)
  )
}

export const SavedSessionSchema = SavedSessionShape.refine(isConsistent, {
  error: 'The saved session does not hold together',
})

export type SavedSession = z.output<typeof SavedSessionSchema>

export function toSaved(session: LearnSession, now: Date): SavedSession {
  return {
    version: 1,
    savedAt: now.toISOString(),
    round: session.round,
    queue: [...session.queue],
    answers: session.answers.map(({ termId, correct, round }) => ({ termId, correct, round })),
    terms: session.terms.map(({ term, level, missed }) => ({ termId: term.id, level, missed })),
  }
}

export interface ResumeInput {
  saved: SavedSession
  /** The file's terms as they are now. */
  terms: readonly Term[]
  progress: ReadonlyMap<string, TermProgress>
}

/**
 * The saved session over the file as it is now: deleted terms leave (queue and answers too),
 * new ones join at the end at their starting level, words come from `terms`. `undefined` when
 * nothing worth continuing is left: no answer, or every term already learned.
 */
export function resumeSession({ saved, terms, progress }: ResumeInput): LearnSession | undefined {
  const current = new Map(terms.map((term) => [term.id, term]))
  const kept = saved.terms.flatMap(({ termId, level, missed }): SessionTerm[] => {
    const term = current.get(termId)
    return term === undefined ? [] : [{ term, level, missed }]
  })
  const keptIds = new Set(kept.map((entry) => entry.term.id))
  const added = terms
    .filter((term) => !keptIds.has(term.id))
    .map((term): SessionTerm => ({
      term,
      level: startingLevel(progress.get(term.id)),
      missed: false,
    }))
  const answers = saved.answers.filter((answer) => keptIds.has(answer.termId))
  if (answers.length === 0) return undefined

  const session: LearnSession = {
    terms: [...kept, ...added],
    round: saved.round,
    queue: saved.queue.filter((id) => keptIds.has(id)),
    answers,
  }
  if (isSessionOver(session)) return undefined
  return session.queue.length === 0 ? startRound(session) : session
}
