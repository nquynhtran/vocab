import { toKey } from '../text.ts'
import { shuffled, type Random } from './random.ts'

/** What a multiple choice option needs from a term. */
export interface ChoiceSource {
  word: string
  meaning: string
}

/** The correct word plus up to this many minus one distractors. */
export const CHOICE_COUNT = 4

/**
 * The options for "which word means `question.meaning`?", shuffled, correct one included.
 * Distractors come from the same file first, then the rest of the folder. Left out: terms with
 * the same meaning (both would be right) and repeated words (a word with several meanings).
 * Fewer than CHOICE_COUNT when there are not enough; a single option means "ask it written".
 * The count of usable distractors decides, not the file size (decision #54).
 */
export function pickChoices(
  question: ChoiceSource,
  fileTerms: readonly ChoiceSource[],
  folderTerms: readonly ChoiceSource[],
  random: Random,
): string[] {
  const meaningKey = toKey(question.meaning)
  const usedWords = new Set([toKey(question.word)])
  const distractors: string[] = []
  for (const candidate of [...shuffled(fileTerms, random), ...shuffled(folderTerms, random)]) {
    if (distractors.length === CHOICE_COUNT - 1) break
    const wordKey = toKey(candidate.word)
    if (usedWords.has(wordKey) || toKey(candidate.meaning) === meaningKey) continue
    usedWords.add(wordKey)
    distractors.push(candidate.word)
  }
  return shuffled([question.word, ...distractors], random)
}
