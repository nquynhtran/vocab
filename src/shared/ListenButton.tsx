import { canSpeak, speak } from './speech.ts'
import { Icon } from './Icon.tsx'

export function ListenButton({ text }: { text: string }) {
  if (!canSpeak()) return null
  return (
    <button
      type="button"
      className="button icon-button"
      aria-label={`Listen to "${text}"`}
      title="Listen"
      onClick={() => speak(text)}
    >
      <Icon name="speaker" />
    </button>
  )
}
