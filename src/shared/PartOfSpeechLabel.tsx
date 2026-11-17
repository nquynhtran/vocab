import type { PartOfSpeech } from '../domain/schemas.ts'
import { PART_OF_SPEECH_ABBREVIATIONS } from './partOfSpeech.ts'

/**
 * The short forms of every part of speech, e.g. "adj. / n.", with the full names on hover. A word
 * can have several (#90), so the list is joined rather than shown as a choice.
 */
export function PartOfSpeechLabel({ partsOfSpeech }: { partsOfSpeech: readonly PartOfSpeech[] }) {
  return (
    <abbr className="pos" title={partsOfSpeech.join(' / ')}>
      {partsOfSpeech.map((part) => PART_OF_SPEECH_ABBREVIATIONS[part]).join(' / ')}
    </abbr>
  )
}
