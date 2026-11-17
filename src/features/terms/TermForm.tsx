import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ValidationError } from '../../domain/errors.ts'
import { type PartOfSpeech, type TermInput, type TermKind } from '../../domain/schemas.ts'
import { errorMessage } from '../../shared/errorMessage.ts'
import { FieldError } from '../../shared/FieldError.tsx'
import { PART_OF_SPEECH_CHOICES, choiceKey, choiceLabel } from '../../shared/partOfSpeech.ts'
import { usePronunciationLookup } from '../../shared/pronunciationLookupContext.ts'
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

const EMPTY: TermInput = {
  word: '',
  kind: 'word',
  partsOfSpeech: [],
  pronunciation: '',
  meaning: '',
  example: '',
}

/** The stored list for a select value; unknown values (none offered) map to no parts. */
function choiceParts(value: string): PartOfSpeech[] {
  return PART_OF_SPEECH_CHOICES.find((parts) => choiceKey(parts) === value)?.slice() ?? []
}

type LookupStatus = 'idle' | 'looking' | 'not-found' | 'failed'

/** Cambridge has no free API, but its search page is the best place to copy from by hand. */
function cambridgeSearchUrl(word: string): string {
  return `https://dictionary.cambridge.org/search/english/direct/?q=${encodeURIComponent(word.trim())}`
}

export function TermForm({
  submitLabel,
  initial = EMPTY,
  termId,
  onSubmit,
  onCancel,
  autoFocus = false,
}: TermFormProps) {
  const [word, setWord] = useState(initial.word)
  const [kind, setKind] = useState<TermKind>(initial.kind ?? 'word')
  const [partsOfSpeech, setPartsOfSpeech] = useState<PartOfSpeech[]>(initial.partsOfSpeech ?? [])
  const [pronunciation, setPronunciation] = useState(initial.pronunciation ?? '')
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle')
  const [meaning, setMeaning] = useState(initial.meaning)
  const [example, setExample] = useState(initial.example ?? '')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const [pending, setPending] = useState(false)
  const wordRef = useRef<HTMLInputElement>(null)
  const lookup = usePronunciationLookup()
  /** The pending lookup. Aborted on any edit of Term or Pronunciation, on submit and unmount. */
  const lookupRef = useRef<AbortController>(undefined)
  const duplicates = useDuplicateWarning(word, termId)
  const baseId = useId()
  const ids = {
    word: `${baseId}-word`,
    kind: `${baseId}-kind`,
    partsOfSpeech: `${baseId}-parts-of-speech`,
    pronunciation: `${baseId}-pronunciation`,
    lookupStatus: `${baseId}-lookup-status`,
    meaning: `${baseId}-meaning`,
    example: `${baseId}-example`,
    warning: `${baseId}-warning`,
  }

  useEffect(() => () => lookupRef.current?.abort(), [])

  /** A result that comes back later must not overwrite what was typed since (docs/ui.md). */
  function cancelLookup() {
    lookupRef.current?.abort()
    lookupRef.current = undefined
  }

  async function handleLookUp() {
    cancelLookup()
    const controller = new AbortController()
    lookupRef.current = controller
    setLookupStatus('looking')
    try {
      const result = await lookup.lookUp(word, controller.signal)
      if (controller.signal.aborted) return
      if (result.kind === 'found') setPronunciation(result.pronunciation)
      setLookupStatus(result.kind === 'found' ? 'idle' : 'not-found')
    } catch (error) {
      if (controller.signal.aborted) return
      // One message for the user; the console tells a CSP block from a 429 or being offline.
      console.warn('Pronunciation lookup failed', error)
      setLookupStatus('failed')
    } finally {
      if (lookupRef.current === controller) lookupRef.current = undefined
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    cancelLookup()
    setLookupStatus('idle')
    setPending(true)
    setFieldErrors({})
    setFormError(undefined)
    try {
      await onSubmit({ word, kind, partsOfSpeech, pronunciation, meaning, example })
      setWord(initial.word)
      setKind(initial.kind ?? 'word')
      setPartsOfSpeech(initial.partsOfSpeech ?? [])
      setPronunciation(initial.pronunciation ?? '')
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
    // Not while saving: the form would be gone before the error (or "may have been saved") shows.
    if (event.key === 'Escape' && onCancel && !pending) onCancel()
  }

  function errorFor(field: keyof TermInput) {
    const messages = fieldErrors[field]
    return messages?.length ? messages.join('. ') : undefined
  }

  const wordError = errorFor('word')
  const kindError = errorFor('kind')
  const partsOfSpeechError = errorFor('partsOfSpeech')
  // A stored combination outside the list is still shown, so editing it never drops it silently.
  const partChoices =
    PART_OF_SPEECH_CHOICES.some((parts) => choiceKey(parts) === choiceKey(partsOfSpeech)) ||
    partsOfSpeech.length === 0
      ? PART_OF_SPEECH_CHOICES
      : [...PART_OF_SPEECH_CHOICES, partsOfSpeech]
  const pronunciationError = errorFor('pronunciation')
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
          onChange={(event) => {
            setWord(event.target.value)
            cancelLookup()
            setLookupStatus('idle')
          }}
          autoFocus={autoFocus}
          autoComplete="off"
          // The browser's own red underline for typos (#60); `lang` picks its English dictionary.
          spellCheck
          lang="en"
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
        <label htmlFor={ids.meaning}>Meaning</label>
        <input
          id={ids.meaning}
          value={meaning}
          onChange={(event) => setMeaning(event.target.value)}
          autoComplete="off"
          // Usually Vietnamese: an English dictionary would underline every word.
          spellCheck={false}
          aria-invalid={meaningError !== undefined}
          aria-describedby={describedBy(meaningError && `${ids.meaning}-error`)}
        />
        <FieldError id={`${ids.meaning}-error`} message={meaningError} />
      </div>
      <div className="field">
        <label htmlFor={ids.partsOfSpeech}>Part of speech</label>
        <select
          id={ids.partsOfSpeech}
          value={choiceKey(partsOfSpeech)}
          onChange={(event) => setPartsOfSpeech(choiceParts(event.target.value))}
          aria-invalid={partsOfSpeechError !== undefined}
          aria-describedby={describedBy(partsOfSpeechError && `${ids.partsOfSpeech}-error`)}
        >
          <option value="">—</option>
          {partChoices.map((parts) => (
            <option key={choiceKey(parts)} value={choiceKey(parts)}>
              {choiceLabel(parts)}
            </option>
          ))}
        </select>
        <FieldError id={`${ids.partsOfSpeech}-error`} message={partsOfSpeechError} />
      </div>
      <div className="field">
        <label htmlFor={ids.pronunciation}>Pronunciation (optional)</label>
        <div className="lookup-row">
          <input
            id={ids.pronunciation}
            value={pronunciation}
            onChange={(event) => {
              setPronunciation(event.target.value)
              cancelLookup()
              if (lookupStatus === 'looking') setLookupStatus('idle')
            }}
            placeholder="/rʌn/"
            autoComplete="off"
            // IPA symbols are not words: every one would be underlined.
            spellCheck={false}
            aria-invalid={pronunciationError !== undefined}
            aria-describedby={describedBy(
              pronunciationError && `${ids.pronunciation}-error`,
              ids.lookupStatus,
            )}
          />
          <button
            type="button"
            className="button"
            onClick={() => void handleLookUp()}
            disabled={word.trim() === '' || lookupStatus === 'looking' || pending}
          >
            {lookupStatus === 'looking' ? 'Looking up…' : 'Look up'}
          </button>
        </div>
        <FieldError id={`${ids.pronunciation}-error`} message={pronunciationError} />
        <p id={ids.lookupStatus} className="lookup-status" role="status">
          {(lookupStatus === 'not-found' || lookupStatus === 'failed') && (
            <>
              {lookupStatus === 'not-found'
                ? 'No pronunciation found.'
                : "Couldn't reach the dictionary. Type it in or try again."}{' '}
              <a href={cambridgeSearchUrl(word)} target="_blank" rel="noopener noreferrer">
                Search Cambridge Dictionary ↗
              </a>
            </>
          )}
        </p>
      </div>
      <div className="field field--wide">
        <label htmlFor={ids.example}>Example (optional)</label>
        <input
          id={ids.example}
          value={example}
          onChange={(event) => setExample(event.target.value)}
          autoComplete="off"
          spellCheck
          lang="en"
          aria-invalid={exampleError !== undefined}
          aria-describedby={describedBy(exampleError && `${ids.example}-error`)}
        />
        <FieldError id={`${ids.example}-error`} message={exampleError} />
      </div>
      <div className="term-form__actions">
        <div className="term-form__option">
          <label className="check-row">
            <input
              type="checkbox"
              checked={kind === 'collocation'}
              onChange={(event) => setKind(event.target.checked ? 'collocation' : 'word')}
            />{' '}
            Collocation (not learned)
          </label>
          <FieldError id={`${ids.kind}-error`} message={kindError} />
        </div>

        <button type="submit" className="button button--primary" disabled={pending}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="button" onClick={onCancel} disabled={pending}>
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
