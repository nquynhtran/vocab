import { useId, useRef, useState, type ChangeEvent } from 'react'
import {
  MAX_BACKUP_FILE_BYTES,
  parseBackupFile,
  validateBackup,
  type Backup,
} from '../../domain/backup.ts'
import { ConnectionError } from '../../domain/errors.ts'
import { compareForRestore, type RestoreComparison } from '../../domain/restoreComparison.ts'
import { plural } from '../../shared/deleteMessages.ts'
import { errorMessage } from '../../shared/errorMessage.ts'
import { useRepository } from '../../shared/repositoryContext.ts'
import { backupFileName, downloadBackup } from './backupFile.ts'
import { importProblems, type ImportProblems } from './importErrors.ts'
import { RestoreReview } from './RestoreReview.tsx'

/** A write that may have committed before its answer was lost (docs/backup.md). */
export const RESTORE_MAYBE_DONE =
  'The restore may or may not have finished. Check your folders on Home; restoring the same ' +
  'file again is safe.'

export interface Review {
  backup: Backup
  /** Read once: both what the screen compares and the copy "Download current data first" saves. */
  current: Backup
  comparison: RestoreComparison
  /** First problem found in current data, when a copy of it could not be restored as is. */
  snapshotProblem?: string
}

export function RestoreBackup() {
  const repository = useRepository()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  // Where focus goes once the comparison closes, so a keyboard user lands on the outcome
  // instead of the top of the page.
  const resultRef = useRef<HTMLDivElement>(null)
  // While reading, the file input is disabled and there is no Cancel yet, so no later pick can
  // race a read still in flight.
  const [reading, setReading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [review, setReview] = useState<Review>()
  const [problems, setProblems] = useState<ImportProblems>()
  const [error, setError] = useState<string>()
  const [done, setDone] = useState<string>()

  function reset() {
    setReview(undefined)
    setProblems(undefined)
    setError(undefined)
    setDone(undefined)
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    reset()
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > MAX_BACKUP_FILE_BYTES) {
      setProblems({ shown: ['This file is larger than 5 MB, too big to be a backup'], hidden: 0 })
      return
    }
    setReading(true)
    try {
      let backup: Backup
      try {
        backup = parseBackupFile(await file.text())
      } catch (cause) {
        setProblems(importProblems(cause))
        return
      }
      const current = await repository.exportBackup()
      setReview({
        backup,
        current,
        comparison: compareForRestore(current, backup),
        snapshotProblem: snapshotProblem(current),
      })
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setReading(false)
    }
  }

  async function handleRestore(backup: Backup) {
    setRestoring(true)
    setError(undefined)
    try {
      await repository.replaceAll(backup)
      setReview(undefined)
      setDone(
        `Restored ${plural(backup.folders.length, 'folder')}, ` +
          `${plural(backup.files.length, 'file')} and ${plural(backup.terms.length, 'term')}.`,
      )
    } catch (cause) {
      if (cause instanceof ConnectionError) {
        // Current data may have changed, so the comparison on screen may be wrong now.
        setReview(undefined)
        setError(RESTORE_MAYBE_DONE)
      } else {
        // Rolled back (or the session expired): nothing changed, the user can press again.
        setError(errorMessage(cause))
      }
    } finally {
      setRestoring(false)
      resultRef.current?.focus()
    }
  }

  function handleCancel() {
    reset()
    inputRef.current?.focus()
  }

  return (
    <div className="restore">
      <h3>Restore from backup</h3>
      <p className="muted">
        Replaces all your folders, files, terms, learning progress and study days with a file made
        with Export JSON.
      </p>
      <label htmlFor={inputId}>Backup file</label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".json,application/json"
        disabled={reading || restoring}
        // Cleared when the picker opens, not after reading, so the chosen name stays visible
        // while picking the same file again (fixed after an error) still fires `change`.
        onClick={(event) => {
          event.currentTarget.value = ''
        }}
        onChange={(event) => void handleFile(event)}
      />
      {reading && <p className="muted">Reading your current data…</p>}
      {problems && (
        <div className="field-error" role="alert">
          <ul className="import-problems">
            {problems.shown.map((problem, index) => (
              <li key={index}>{problem}</li>
            ))}
          </ul>
          {problems.hidden > 0 && <p>…and {problems.hidden} more.</p>}
        </div>
      )}
      {review && (
        <RestoreReview
          review={review}
          busy={restoring}
          onDownload={() => downloadBackup(review.current, backupFileName(new Date()))}
          onRestore={() => void handleRestore(review.backup)}
          onCancel={handleCancel}
        />
      )}
      <div ref={resultRef} tabIndex={-1} className="restore__result">
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {/* Always rendered: screen readers often skip a live region inserted with its text. */}
        <p role="status" className={done ? 'restore__done' : undefined}>
          {done}
        </p>
      </div>
    </div>
  )
}

/**
 * `exportBackup` does not validate on purpose (#41): a safety copy must download even when a
 * stored row is off. Warn instead of blocking, so the user knows that copy needs fixing first.
 */
function snapshotProblem(current: Backup): string | undefined {
  try {
    validateBackup(current)
    return undefined
  } catch (cause) {
    return importProblems(cause).shown[0]
  }
}
