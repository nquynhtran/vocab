import type { PartOfSpeech } from '../domain/schemas.ts'

/** Display only; the stored value is the full name, so these can change freely. */
export const PART_OF_SPEECH_ABBREVIATIONS: Readonly<Record<PartOfSpeech, string>> = {
  noun: 'n.',
  verb: 'v.',
  adjective: 'adj.',
  adverb: 'adv.',
  'phrasal verb': 'phr. v.',
  phrase: 'phr.',
  preposition: 'prep.',
  conjunction: 'conj.',
  pronoun: 'pron.',
  other: 'other',
}

/**
 * The choices of the Part of speech select (#90): none, each part alone, and the common pairs.
 * "verb / noun" is the same set as "noun / verb" and is stored in the list order of
 * PARTS_OF_SPEECH, so only one of them is offered.
 */
export const PART_OF_SPEECH_CHOICES: readonly (readonly PartOfSpeech[])[] = [
  ['noun'],
  ['verb'],
  ['adjective'],
  ['adverb'],
  ['phrasal verb'],
  ['phrase'],
  ['preposition'],
  ['conjunction'],
  ['pronoun'],
  ['other'],
  ['noun', 'verb'],
  ['noun', 'adjective'],
  ['adjective', 'adverb'],
]

/** The select's value for a choice: its parts joined, which is unique and readable. */
export function choiceKey(parts: readonly PartOfSpeech[]): string {
  return parts.join(' / ')
}

/** "noun / verb (n. / v.)": full names, then the short forms, as the list shows them. */
export function choiceLabel(parts: readonly PartOfSpeech[]): string {
  return `${choiceKey(parts)} (${parts.map((part) => PART_OF_SPEECH_ABBREVIATIONS[part]).join(' / ')})`
}
