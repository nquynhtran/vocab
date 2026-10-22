import type { PartOfSpeech } from '../../domain/schemas.ts'

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
