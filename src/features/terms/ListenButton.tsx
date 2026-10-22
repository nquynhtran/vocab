import { canSpeak, speak } from '../../shared/speech.ts'

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
      <span aria-hidden="true">🔊</span>
    </button>
  )
}
