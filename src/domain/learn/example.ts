import { straightenQuotes } from '../text.ts'

export const BLANK = '____'

const LETTER_OR_DIGIT = '[\\p{L}\\p{N}\\p{M}]'

/**
 * The example with every whole-word occurrence of `word` hidden, or undefined when the word does
 * not appear as is (e.g. "ran" for "run"): then showing the example would give the answer away.
 * Matching ignores case and treats curly quotes as straight ones, like `toKey`. Both texts are
 * already normalized when stored (NFC, single spaces), so only those two differences remain.
 */
export function maskExample(example: string | undefined, word: string): string | undefined {
  if (example === undefined || word === '') return undefined
  // Same length as the original, so match positions carry over to the text shown.
  const comparable = straightenQuotes(example)
  const pattern = new RegExp(
    `(?<!${LETTER_OR_DIGIT})${escapeRegExp(straightenQuotes(word))}(?!${LETTER_OR_DIGIT})`,
    'giu',
  )
  let masked = ''
  let last = 0
  for (const match of comparable.matchAll(pattern)) {
    masked += example.slice(last, match.index) + BLANK
    last = match.index + match[0].length
  }
  return last === 0 ? undefined : masked + example.slice(last)
}

/**
 * Only syntax characters: with the `u` flag, escaping anything else ("\-") is a syntax error,
 * so a hyphenated word like "well-known" would throw.
 */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
}
