import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ValidationError } from '../../domain/errors.ts'
import { PARTS_OF_SPEECH, type PartOfSpeech, type TermInput } from '../../domain/schemas.ts'
import { errorMessage } from '../../shared/errorMessage.ts'
import { FieldError } from '../../shared/FieldError.tsx'
import { PART_OF_SPEECH_ABBREVIATIONS } from './partOfSpeech.ts'
import { formatLocations, useDuplicateWarning } from './useDuplicateWarning.ts'

interface TermFormProps {
  submitLabel: string
  initial?: TermInput
  /** When editing, the term itself is not a duplicate of itself. */
  termId?: string
  /** Throws to show errors; resolves to reset the form for the next term. */
  onSubmit: (input: TermInput) => Promise<void>
  onCancel?: () => void
  autoFocus?: boolean
}

type FieldErrors = Readonly<Record<string, readonly string[]>>

const EMPTY: TermInput = { word: '', partOfSpeech: '', meaning: '', example: '' }

export function TermForm({
  submitLabel,
  initial = EMPTY,
  termId,
  onSubmit,
  onCancel,
  autoFocus = false,
}: TermFormProps) {
  const [word, setWord] = useState(initial.word)
  const [partOfSpeech, setPartOfSpeech] = useState<PartOfSpeech | ''>(initial.partOfSpeech ?? '')
  const [meaning, setMeaning] = useState(initial.meaning)
  const [example, setExample] = useState(initial.example ?? '')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const [pending, setPending] = useState(false)
  const wordRef = useRef<HTMLInputElement>(null)
  const duplicates = useDuplicateWarning(word, termId)
  const baseId = useId()
  const ids = {
    word: `${baseId}-word`,
    partOfSpeech: `${baseId}-part-of-speech`,
    meaning: `${baseId}-meaning`,
    example: `${baseId}-example`,
    warning: `${baseId}-warning`,
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setFieldErrors({})
    setFormError(undefined)
    try {
      await onSubmit({ word, partOfSpeech, meaning, example })
      setWord(initial.word)
      setPartOfSpeech(initial.partOfSpeech ?? '')
      setMeaning(initial.meaning)
      setExample(initial.example ?? '')
      // Ready for the next term without reaching for the mouse.
      wordRef.current?.focus()
    } catch (caught) {
      if (caught instanceof ValidationError) setFieldErrors(caught.fieldErrors)
      else setFormError(errorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && onCancel) onCancel()
  }

  function errorFor(field: keyof TermInput) {
    const messages = fieldErrors[field]
    return messages?.length ? messages.join('. ') : undefined
  }

  const wordError = errorFor('word')
  const partOfSpeechError = errorFor('partOfSpeech')
  const meaningError = errorFor('meaning')
  const exampleError = errorFor('example')

  return (
    <form className="term-form" onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate>
      <div className="field">
        <label htmlFor={ids.word}>Term</label>
        <input
          id={ids.word}
          ref={wordRef}
          value={word}
          onChange={(event) => setWord(event.target.value)}
          autoFocus={autoFocus}
          autoComplete="off"
          aria-invalid={wordError !== undefined}
          aria-describedby={describedBy(
            wordError && `${ids.word}-error`,
            duplicates.length > 0 && ids.warning,
          )}
        />
        <FieldError id={`${ids.word}-error`} message={wordError} />
        {/* Always in the DOM: screen readers announce changes to a live region, not its insertion. */}
        <p
          id={ids.warning}
          className={duplicates.length > 0 ? 'field-warning' : undefined}
          role="status"
        >
          {duplicates.length > 0 && `Already in ${formatLocations(duplicates)}`}
        </p>
      </div>
      <div className="field">
        <label htmlFor={ids.partOfSpeech}>Part of speech</label>
        <select
          id={ids.partOfSpeech}
          value={partOfSpeech}
          // Options come from PARTS_OF_SPEECH, and the repository validates again anyway.
          onChange={(event) => setPartOfSpeech(event.target.value as PartOfSpeech | '')}
          aria-invalid={partOfSpeechError !== undefined}
          aria-describedby={describedBy(partOfSpeechError && `${ids.partOfSpeech}-error`)}
        >
          <option value="">—</option>
          {PARTS_OF_SPEECH.map((value) => (
            <option key={value} value={value}>
              {value} ({PART_OF_SPEECH_ABBREVIATIONS[value]})
            </option>
          ))}
        </select>
        <FieldError id={`${ids.partOfSpeech}-error`} message={partOfSpeechError} />
      </div>
      <div className="field">
        <label htmlFor={ids.meaning}>Meaning</label>
        <input
          id={ids.meaning}
          value={meaning}
          onChange={(event) => setMeaning(event.target.value)}
          autoComplete="off"
          aria-invalid={meaningError !== undefined}
          aria-describedby={describedBy(meaningError && `${ids.meaning}-error`)}
        />
        <FieldError id={`${ids.meaning}-error`} message={meaningError} />
      </div>
      <div className="field">
        <label htmlFor={ids.example}>Example (optional)</label>
        <input
          id={ids.example}
          value={example}
          onChange={(event) => setExample(event.target.value)}
          autoComplete="off"
          aria-invalid={exampleError !== undefined}
          aria-describedby={describedBy(exampleError && `${ids.example}-error`)}
        />
        <FieldError id={`${ids.example}-error`} message={exampleError} />
      </div>
      <div className="term-form__actions">
        <button type="submit" className="button button--primary" disabled={pending}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
      {formError && (
        <p className="field-error" role="alert">
          {formError}
        </p>
      )}
    </form>
  )
}

function describedBy(...ids: (string | false | undefined)[]): string | undefined {
  return ids.filter(Boolean).join(' ') || undefined
}
