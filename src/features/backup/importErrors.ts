import { ValidationError } from '../../domain/errors.ts'
import { errorMessage } from '../../shared/errorMessage.ts'

/** Enough to locate the problem in the file without burying the page in messages. */
export const MAX_SHOWN_PROBLEMS = 5

export interface ImportProblems {
  /** E.g. `terms.3.word: Too long`, in the order validation found them. */
  shown: string[]
  /** How many more were found but not shown. */
  hidden: number
}

/** Each problem of an invalid backup on its own line, with where it is in the file. */
export function importProblems(error: unknown): ImportProblems {
  if (!(error instanceof ValidationError)) return { shown: [errorMessage(error)], hidden: 0 }
  const all = Object.entries(error.fieldErrors).flatMap(([path, messages]) =>
    messages.map((message) => (path === '_' ? message : `${path}: ${message}`)),
  )
  return {
    shown: all.slice(0, MAX_SHOWN_PROBLEMS),
    hidden: Math.max(0, all.length - MAX_SHOWN_PROBLEMS),
  }
}
