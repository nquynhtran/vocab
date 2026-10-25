import { daysBetween, localDay } from '../day.ts'
import { BOX_MAX, type Term, type TermProgress } from '../schemas.ts'
import { randomInt, type Random } from './random.ts'

/**
 * Decides the order terms are studied in (Strategy): swapping in FSRS later only replaces this.
 * `progress` holds only terms studied before; `today` is a local day (`localDay`).
 */
export interface TermSelector {
  order(
    terms: readonly Term[],
    progress: ReadonlyMap<string, TermProgress>,
    today: string,
    random: Random,
  ): Term[]
}

/** Caps keep a term missed often long ago from staying first forever. */
const WRONG_CAP = 5
const DAYS_CAP = 30
const NEVER_STUDIED_BONUS = 5
const RANDOM_MAX = 3

/** docs/learn-algorithm.md#một-phiên-học, step 2. Higher comes first. */
export function priority(
  progress: TermProgress | undefined,
  today: string,
  random: Random,
): number {
  const box = progress?.box ?? 1
  const wrongCount = progress?.wrongCount ?? 0
  const lastStudiedAt = progress?.lastStudiedAt
  const daysSinceStudied =
    lastStudiedAt === undefined ? 0 : daysBetween(localDay(new Date(lastStudiedAt)), today)
  return (
    (BOX_MAX + 1 - box) * 10 +
    Math.min(wrongCount, WRONG_CAP) * 3 +
    Math.min(Math.max(daysSinceStudied, 0), DAYS_CAP) +
    (lastStudiedAt === undefined ? NEVER_STUDIED_BONUS : 0) +
    randomInt(random, 0, RANDOM_MAX)
  )
}

/** Leitner boxes plus mistakes and time since last study. */
export const leitnerSelector: TermSelector = {
  order(terms, progress, today, random) {
    return terms
      .map((term) => ({ term, score: priority(progress.get(term.id), today, random) }))
      .sort((a, b) => b.score - a.score)
      .map(({ term }) => term)
  },
}
