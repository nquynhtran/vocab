import type { PartOfSpeech } from '../domain/schemas.ts'
import { PART_OF_SPEECH_ABBREVIATIONS } from './partOfSpeech.ts'

/** The short form, e.g. "v.", with the full name on hover. */
export function PartOfSpeechLabel({ partOfSpeech }: { partOfSpeech: PartOfSpeech }) {
  return (
    <abbr className="pos" title={partOfSpeech}>
      {PART_OF_SPEECH_ABBREVIATIONS[partOfSpeech]}
    </abbr>
  )
}
