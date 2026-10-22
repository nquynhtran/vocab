import { useId, useState, type FormEvent, type KeyboardEvent } from 'react'
import { errorMessage } from './errorMessage.ts'

interface NameFormProps {
  label: string
  submitLabel: string
  initialName?: string
  /** Throws to show the error under the field; resolves to clear the field. */
  onSubmit: (name: string) => Promise<void>
  onCancel?: () => void
  autoFocus?: boolean
}

/** Create or rename a folder/file. Validation happens in the repository (one source of truth). */
export function NameForm({
  label,
  submitLabel,
  initialName = '',
  onSubmit,
  onCancel,
  autoFocus = false,
}: NameFormProps) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  const inputId = useId()
  const errorId = useId()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(undefined)
    try {
      await onSubmit(name)
      setName(initialName)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && onCancel) onCancel()
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate>
      <label htmlFor={inputId}>{label}</label>
      <div className="inline-form__row">
        <input
          id={inputId}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus={autoFocus}
          autoComplete="off"
          aria-invalid={error !== undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <button type="submit" className="button button--primary" disabled={pending}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
