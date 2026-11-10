import { straightenQuotes } from '../text.ts'

export const BLANK = '____'

const LETTER_OR_DIGIT = '[\\p{L}\\p{N}\\p{M}]'

/**
 * The example with every whole-word occurrence of `word` hidden, regular inflections included
 * ("decided" for "decide", #82), or undefined when the word does not appear (e.g. "ran" for
 * "run"): then showing the example would give the answer away.
 * Matching ignores case and treats curly quotes as straight ones, like `toKey`. Both texts are
 * already normalized when stored (NFC, single spaces), so only those two differences remain.
 */
export function maskExample(example: string | undefined, word: string): string | undefined {
  if (example === undefined || word === '') return undefined
  // Same length as the original, so match positions carry over to the text shown.
  const comparable = straightenQuotes(example)
  const phrase = straightenQuotes(word)
    .split(' ')
    .map((token) => `(?:${regularForms(token).map(escapeRegExp).join('|')})`)
    .join(' ')
  const pattern = new RegExp(`(?<!${LETTER_OR_DIGIT})${phrase}(?!${LETTER_OR_DIGIT})`, 'giu')
  let masked = ''
  let last = 0
  for (const match of comparable.matchAll(pattern)) {
    masked += example.slice(last, match.index) + BLANK
    last = match.index + match[0].length
  }
  return last === 0 ? undefined : masked + example.slice(last)
}

/**
 * The token and its regular -s/-ed/-ing forms. Some forms are other real words ("car" →
 * "cared", "hop" → "hoped"): then an example that would have been hidden is shown with the wrong
 * word blanked. Unavoidable for -ed/-ing ("visit" → "visited" needs the plain ending), so -es is
 * kept to the endings that take it. A two-letter token gets no -d/-ed/doubling, so "be" does
 * not hide "bed". Tokens with other characters ("don't", "C++") stay as typed.
 */
function regularForms(token: string): string[] {
  const lower = token.toLowerCase()
  if (lower.length < 2 || !/^\p{L}+$/u.test(lower)) return [token]
  const forms = [lower, `${lower}s`, `${lower}ing`]
  if (/(?:[sxzo]|ch|sh)$/.test(lower)) forms.push(`${lower}es`)
  if (lower.length < 3) return forms
  forms.push(`${lower}ed`)
  if (lower.endsWith('ie')) forms.push(`${lower.slice(0, -2)}ying`)
  if (lower.endsWith('e')) forms.push(`${lower}d`, `${lower.slice(0, -1)}ing`)
  if (/[^aeiou]y$/.test(lower)) forms.push(`${lower.slice(0, -1)}ies`, `${lower.slice(0, -1)}ied`)
  const lastLetter = lower.slice(-1)
  if (/[aeiou][b-df-hj-np-tvz]$/.test(lower)) {
    forms.push(`${lower}${lastLetter}ed`, `${lower}${lastLetter}ing`)
  }
  return forms
}

/**
 * Only syntax characters: with the `u` flag, escaping anything else ("\-") is a syntax error,
 * so a hyphenated word like "well-known" would throw.
 */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
}
