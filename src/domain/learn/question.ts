import { pickChoices, type ChoiceSource } from './choices.ts'
import { maskExample } from './example.ts'
import type { Random } from './random.ts'
import type { SessionTerm } from './session.ts'

/**
 * What the screen asks: always the meaning, answered with the English word. The part of speech
 * is not shown as a hint (decision #53).
 */
export type Question =
  | { kind: 'choice'; termId: string; meaning: string; word: string; choices: string[] }
  | { kind: 'written'; termId: string; meaning: string; word: string; example?: string }

/**
 * Level 0 is multiple choice, unless no distractor is usable: then it is written, and stays
 * written at level 1 too. That is on purpose (docs/learn-algorithm.md#chọn-đáp-án-nhiễu).
 */
export function buildQuestion(
  { term, level }: SessionTerm,
  fileTerms: readonly ChoiceSource[],
  folderTerms: readonly ChoiceSource[],
  random: Random,
): Question {
  const base = { termId: term.id, meaning: term.meaning, word: term.word }
  if (level === 0) {
    const choices = pickChoices(term, fileTerms, folderTerms, random)
    if (choices.length > 1) return { kind: 'choice', ...base, choices }
  }
  const example = maskExample(term.example, term.word)
  return { kind: 'written', ...base, ...(example !== undefined && { example }) }
}
