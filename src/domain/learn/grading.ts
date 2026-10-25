import { toKey } from '../text.ts'

/** `almost`: one typo in a longer word, counted as correct but shown (docs/learn-algorithm.md). */
export type WrittenGrade = 'correct' | 'almost' | 'wrong'

/** Shorter words have too few letters for one typo to be told apart from another word. */
export const TYPO_MIN_LENGTH = 5

const EDGE_PUNCTUATION = /^[\p{P}\s]+|[\p{P}\s]+$/gu

/**
 * `toKey`, then punctuation at both ends dropped ("run." and "run" are the same answer).
 * Text that is only punctuation keeps it, or every answer to the word "?" would be blank = right.
 */
export function normalizeAnswer(text: string): string {
  const key = toKey(text)
  return key.replace(EDGE_PUNCTUATION, '') || key
}

export function gradeWritten(answer: string, word: string): WrittenGrade {
  const given = normalizeAnswer(answer)
  const expected = normalizeAnswer(word)
  if (given === expected) return 'correct'
  if (given === '') return 'wrong'
  const expectedLength = [...expected].length
  return expectedLength >= TYPO_MIN_LENGTH && levenshtein(given, expected) === 1
    ? 'almost'
    : 'wrong'
}

/** Edit distance over code points, so an accented letter or an emoji counts as one character. */
export function levenshtein(a: string, b: string): number {
  const from = [...a]
  const to = [...b]
  let previous = Array.from({ length: to.length + 1 }, (_, index) => index)
  for (let i = 1; i <= from.length; i++) {
    const current = [i]
    for (let j = 1; j <= to.length; j++) {
      const substitution = previous[j - 1]! + (from[i - 1] === to[j - 1] ? 0 : 1)
      current.push(Math.min(previous[j]! + 1, current[j - 1]! + 1, substitution))
    }
    previous = current
  }
  return previous[to.length]!
}
