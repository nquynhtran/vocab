import type { PartOfSpeech } from '../schemas.ts'
import { pickChoices, type ChoiceSource } from './choices.ts'
import { maskExample } from './example.ts'
import type { Random } from './random.ts'
import type { SessionTerm } from './session.ts'

/**
 * What the screen asks: always the meaning, with the part of speech when known (#61) and the
 * example with the word hidden, when it can be hidden (#57).
 */
interface Asked {
  termId: string
  meaning: string
  partOfSpeech?: PartOfSpeech
  example?: string
  /** The answer. */
  word: string
  /** Shown with the answer only, never while asking: it would give the written answer away. */
  pronunciation?: string
}

export type Question =
  ({ kind: 'choice'; choices: string[] } & Asked) | ({ kind: 'written' } & Asked)

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
  const example = maskExample(term.example, term.word)
  const base: Asked = {
    termId: term.id,
    meaning: term.meaning,
    ...(term.partOfSpeech !== undefined && { partOfSpeech: term.partOfSpeech }),
    ...(example !== undefined && { example }),
    word: term.word,
    ...(term.pronunciation !== undefined && { pronunciation: term.pronunciation }),
  }
  if (level === 0) {
    const choices = pickChoices(term, fileTerms, folderTerms, random)
    if (choices.length > 1) return { kind: 'choice', ...base, choices }
  }
  return { kind: 'written', ...base }
}
