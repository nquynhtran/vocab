import { useId, useState, type FormEvent } from 'react'
import { ValidationError } from '../../domain/errors.ts'
import { NOTES_MAX_LENGTH, type VocabFile } from '../../domain/schemas.ts'
import { errorMessage } from '../../shared/errorMessage.ts'
import { FieldError } from '../../shared/FieldError.tsx'
import { clearNotesDraft, readNotesDraft, writeNotesDraft } from './notesDraft.ts'

/** Fixed to English digits so every device shows "1,234" (docs/ui.md). */
const formatCount = (count: number) => count.toLocaleString('en')

interface FileNotesProps {
  file: VocabFile
  /** Throws to show errors, like a form's onSubmit. */
  onSave: (notes: string) => Promise<void>
}

/**
 * The collapsible Notes of a file (F8, docs/ui.md#ghi-chú-file-f8). Render with `key={file.id}`:
 * the text being edited is this component's own state, set only when editing starts, so the
 * page reloading `file` after a failed save never replaces it (#43).
 */
export function FileNotes({ file, onSave }: FileNotesProps) {
  const [draft] = useState(() => readNotesDraft(file.id))
  const [editing, setEditing] = useState(draft !== undefined)
  const [open, setOpen] = useState(draft !== undefined)
  const [text, setText] = useState(draft ?? '')
  const [restored, setRestored] = useState(draft !== undefined)
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  const baseId = useId()
  const ids = { text: `${baseId}-text`, count: `${baseId}-count`, error: `${baseId}-error` }
  const notes = file.notes ?? ''
  const tooLong = text.length > NOTES_MAX_LENGTH

  function startEditing() {
    setText(notes)
    setError(undefined)
    setRestored(false)
    setEditing(true)
  }

  function stopEditing() {
    clearNotesDraft(file.id)
    setEditing(false)
    setRestored(false)
    setError(undefined)
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(undefined)
    try {
      await onSave(text)
      stopEditing()
    } catch (caught) {
      // The draft stays, so the text survives a reload until a save works.
      setError(
        caught instanceof ValidationError
          ? Object.values(caught.fieldErrors).flat().join('. ')
          : errorMessage(caught),
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <details
      className="notes"
      open={open || editing}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        Notes
        {notes !== '' && <span className="muted"> · {formatCount(notes.length)} characters</span>}
      </summary>
      {editing ? (
        <form className="notes__form" onSubmit={handleSave} noValidate>
          {restored && (
            <p className="muted" role="status">
              Unsaved draft restored.
            </p>
          )}
          <textarea
            id={ids.text}
            aria-label="Notes"
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              writeNotesDraft(file.id, event.target.value)
            }}
            rows={12}
            // No maxLength: it would silently cut a long paste. Too long shows below instead.
            // Notes may be Vietnamese, and pasted text underlined everywhere is only noise.
            spellCheck={false}
            aria-invalid={tooLong || error !== undefined}
            aria-describedby={[ids.count, error && ids.error].filter(Boolean).join(' ')}
          />
          <p id={ids.count} className={tooLong ? 'notes__count field-error' : 'notes__count muted'}>
            {formatCount(text.length)} / {formatCount(NOTES_MAX_LENGTH)}
            {tooLong && ` · ${formatCount(text.length - NOTES_MAX_LENGTH)} characters too many`}
          </p>
          <FieldError id={ids.error} message={error} />
          <div className="notes__actions">
            <button type="submit" className="button button--primary" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </button>
            {/* Escape does not cancel: one slip would lose a long text. */}
            <button type="button" className="button" onClick={stopEditing} disabled={pending}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          {notes === '' ? (
            <p className="muted">No notes yet.</p>
          ) : (
            <p className="notes__text">{notes}</p>
          )}
          <button type="button" className="button" onClick={startEditing}>
            {notes === '' ? 'Add notes' : 'Edit notes'}
          </button>
        </>
      )}
    </details>
  )
}
