import type { TermProgress } from './schemas.ts'

/** A term counts as mastered from this Leitner box on. See docs/learn-algorithm.md. */
export const MASTERED_BOX = 3

export function isMastered(progress: Pick<TermProgress, 'box'> | undefined): boolean {
  return progress !== undefined && progress.box >= MASTERED_BOX
}

/**
 * Rounded down so the screen only says 100% when every term is mastered,
 * and an empty file shows 0% instead of NaN.
 */
export function masteredPercent(masteredCount: number, termCount: number): number {
  if (termCount <= 0) return 0
  return Math.floor((masteredCount / termCount) * 100)
}
