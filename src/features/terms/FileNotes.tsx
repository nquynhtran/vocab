import { useEffect, useId, useState, type FormEvent } from 'react'
import { ValidationError } from '../../domain/errors.ts'
import { NOTES_MAX_LENGTH, type VocabFile } from '../../domain/schemas.ts'
import { normalizeMultilineText } from '../../domain/text.ts'
import { errorMessage } from '../../shared/errorMessage.ts'
import { FieldError } from '../../shared/FieldError.tsx'
import { clearNotesDraft, readNotesDraft, writeNotesDraft } from './notesDraft.ts'

/**
 * The saved notes if they differ from where editing started. Equal to the text being saved means
 * an earlier save did arrive and only its answer was lost: no conflict, saving again is harmless.
 */
function changedSince(base: string, saved: string, text: string): string | undefined {
  return saved === base || saved === normalizeMultilineText(text) ? undefined : saved
}

/** Fixed to English digits so every device shows "1,234" (docs/ui.md). */
const formatCount = (count: number) => count.toLocaleString('en')

interface FileNotesProps {
  file: VocabFile
  /** Resolves to the saved file; throws to show errors, like a form's onSubmit. */
  onSave: (notes: string) => Promise<VocabFile>
  /** The file as stored now: this page may have been open for days on a phone (#69). */
  loadLatest: () => Promise<VocabFile | undefined>
}

/**
 * The collapsible Notes of a file (F8, docs/ui.md#ghi-chú-file-f8). Render with `key={file.id}`:
 * the text being edited is this component's own state, set only when editing starts, so the
 * page reloading `file` after a failed save never replaces it (#43).
 *
 * Notes are long, so a silent "last write wins" (#42) could lose a whole reading: editing starts
 * from the latest saved notes, and they are compared again on restoring a draft and on Save. A
 * change made meanwhile is only reported, with Save anyway; nothing is merged (#69).
 */
export function FileNotes({ file, onSave, loadLatest }: FileNotesProps) {
  const [draft] = useState(() => readNotesDraft(file.id))
  const [editing, setEditing] = useState(draft !== undefined)
  const [open, setOpen] = useState(draft !== undefined)
  const [text, setText] = useState(draft?.text ?? '')
  const [base, setBase] = useState(draft?.base ?? '')
  /** The newer saved notes the user was told about; Save then replaces exactly those. */
  const [conflict, setConflict] = useState(() =>
    draft === undefined ? undefined : changedSince(draft.base, file.notes ?? '', draft.text),
  )
  const [status, setStatus] = useState('')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  const baseId = useId()
  const ids = { text: `${baseId}-text`, count: `${baseId}-count`, error: `${baseId}-error` }
  // What this device just saved, shown until the page has reloaded a file at least as new:
  // otherwise the old notes would show meanwhile, or for good if that reload fails, and the
  // next Edit would start from them and overwrite what was just saved.
  const [saved, setSaved] = useState<VocabFile>()
  const shown = saved !== undefined && saved.updatedAt >= file.updatedAt ? saved : file
  const notes = shown.notes ?? ''
  const tooLong = text.length > NOTES_MAX_LENGTH

  // A tick after mounting: a live region announces changes to its text, not its first render.
  useEffect(() => {
    if (draft === undefined) return undefined
    const timer = setTimeout(() => setStatus('Unsaved draft restored.'), 0)
    return () => clearTimeout(timer)
  }, [draft])

  async function startEditing() {
    setStarting(true)
    // If this cannot be read, Save compares again; a failed read must not block editing.
    const latest = await loadLatest().catch(() => undefined)
    if (latest) setSaved(latest)
    const current = latest ? (latest.notes ?? '') : notes
    setText(current)
    setBase(current)
    setError(undefined)
    setStarting(false)
    setEditing(true)
  }

  function stopEditing() {
    clearNotesDraft(file.id)
    setEditing(false)
    setStatus('')
    setConflict(undefined)
    setError(undefined)
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(undefined)
    try {
      const latest = await loadLatest().catch(() => undefined)
      const changed = latest && changedSince(base, latest.notes ?? '', text)
      if (changed !== undefined && changed !== conflict) {
        setConflict(changed)
        return
      }
      setSaved(await onSave(text))
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
          <p className="notes__status muted" role="status">
            {status}
          </p>
          {conflict !== undefined && (
            <div className="field-warning" role="alert">
              <p>
                The saved notes changed after you started editing, maybe on another device. Saving
                replaces them.
              </p>
              <details>
                <summary>Show the saved notes</summary>
                <p className="notes__text">{conflict || '(empty)'}</p>
              </details>
            </div>
          )}
          <textarea
            id={ids.text}
            aria-label="Notes"
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              writeNotesDraft(file.id, { text: event.target.value, base })
            }}
            rows={12}
            // What is typed while saving would be dropped with the draft once the save is done.
            readOnly={pending}
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
              {pending ? 'Saving…' : conflict === undefined ? 'Save' : 'Save anyway'}
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
          <button
            type="button"
            className="button"
            onClick={() => void startEditing()}
            disabled={starting}
          >
            {notes === '' ? 'Add notes' : 'Edit notes'}
          </button>
        </>
      )}
    </details>
  )
}
