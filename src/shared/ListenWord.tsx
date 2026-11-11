import { Icon } from './Icon.tsx'
import { canSpeak, speak } from './speech.ts'

/**
 * The whole word is the button, so a phone user taps the word itself to hear it; the faint
 * speaker after it says that it can be tapped. Without speech it is plain text.
 */
export function ListenWord({ word, className }: { word: string; className: string }) {
  if (!canSpeak()) return <span className={className}>{word}</span>
  return (
    <button
      type="button"
      className={`${className} listen-word`}
      aria-label={`Listen to "${word}"`}
      onClick={() => speak(word)}
    >
      {word}
      <Icon name="speaker" className="listen-word__icon" />
    </button>
  )
}
