/** British English, chosen by the user (decision #30). */
export const SPEECH_LANG = 'en-GB'

/** Old browsers and jsdom have no speech synthesis; the Listen button is then hidden. */
export function canSpeak(): boolean {
  return 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
}

// Chrome and Safari load voices asynchronously and return [] on the first call; asking once at
// startup means the list is usually ready by the first click on 🔊.
if (canSpeak()) window.speechSynthesis.getVoices()

/** Must run inside a click handler: iOS Safari only speaks in response to a user gesture. */
export function speak(text: string): void {
  const synth = window.speechSynthesis
  // Restart instead of queueing behind a word that is still being read.
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = SPEECH_LANG
  // Some browsers ignore `lang` without a matching voice; Android reports "en_GB".
  const voice = synth.getVoices().find((v) => v.lang.replace('_', '-') === SPEECH_LANG)
  if (voice) utterance.voice = voice
  synth.speak(utterance)
}
