import { useRef } from 'react'
import { ListenButton } from '../../shared/ListenButton.tsx'
import type { Answered } from './learnFlow.ts'

/**
 * After an answer: the verdict, the right word (with 🔊, safe now that it is no secret) and
 * Continue, focused so Enter moves on. "I was right" only for a written answer graded wrong.
 */
export function Feedback({
  answered,
  busy,
  onContinue,
  onOverrule,
}: {
  answered: Answered
  busy: boolean
  onContinue: () => void
  onOverrule: () => void
}) {
  const { question, given, grade, overridden } = answered
  const written = question.kind === 'written'
  const canOverrule = written && grade === 'wrong' && !overridden && !busy
  const right = grade !== 'wrong' || overridden
  const continueRef = useRef<HTMLButtonElement>(null)
  return (
    <div className={`feedback ${right ? 'feedback--right' : 'feedback--wrong'}`}>
      <p className="feedback__verdict" role="status">
        {verdict(answered)}
      </p>
      {written && grade !== 'correct' && (
        <p>
          You wrote: <span className="feedback__given">{given.trim() || '(nothing)'}</span>
        </p>
      )}
      <p className="feedback__answer">
        Answer: <strong>{question.word}</strong> <ListenButton text={question.word} />
      </p>
      <div className="feedback__actions">
        <button
          ref={continueRef}
          type="button"
          className="button button--primary"
          onClick={onContinue}
          disabled={busy}
          autoFocus
        >
          {busy ? 'Saving…' : 'Continue'}
        </button>
        {canOverrule && (
          <button
            type="button"
            className="button"
            onClick={() => {
              onOverrule()
              // This button disappears: keep Enter on Continue (docs/ui.md).
              continueRef.current?.focus()
            }}
          >
            I was right
          </button>
        )}
      </div>
    </div>
  )
}

function verdict({ grade, overridden }: Answered): string {
  if (overridden) return 'Counted as correct.'
  if (grade === 'correct') return 'Correct!'
  if (grade === 'almost') return 'Almost! Check the spelling.'
  return 'Not quite.'
}
