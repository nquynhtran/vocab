import { useEffect, useRef } from 'react'
import type { Question } from '../../domain/learn/question.ts'

type Choice = Extract<Question, { kind: 'choice' }>

/**
 * The options, answerable with keys 1-4 too. Once `picked` is set they are locked and marked:
 * the right word green, a wrong pick red.
 */
export function ChoiceQuestion({
  question,
  picked,
  onPick,
}: {
  question: Choice
  picked?: string
  onPick?: (choice: string) => void
}) {
  const listRef = useRef<HTMLOListElement>(null)
  useEffect(() => {
    if (onPick === undefined) return
    function handleKey(event: KeyboardEvent) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
      // The listener is on window, so `inert` (the page under AuthGate's sign-in dialog) does
      // not stop it: a key pressed in the dialog must not answer a question nobody sees.
      if (isTextField(event.target) || listRef.current?.closest('[inert]')) return
      const choice = /^[1-9]$/.test(event.key) ? question.choices[Number(event.key) - 1] : undefined
      if (choice === undefined || onPick === undefined) return
      event.preventDefault()
      onPick(choice)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [question, onPick])

  return (
    <ol ref={listRef} className="choices" aria-label="Choices">
      {question.choices.map((choice, index) => (
        <li key={choice}>
          <button
            type="button"
            className={`button choice ${markFor(choice, question.word, picked)}`}
            disabled={picked !== undefined}
            onClick={() => onPick?.(choice)}
          >
            <span className="choice__key" aria-hidden="true">
              {index + 1}
            </span>
            {choice}
          </button>
        </li>
      ))}
    </ol>
  )
}

function markFor(choice: string, word: string, picked: string | undefined): string {
  if (picked === undefined) return ''
  if (choice === word) return 'choice--right'
  return choice === picked ? 'choice--wrong' : ''
}

/** Typing "1" in a text box must not pick an option. */
function isTextField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}
