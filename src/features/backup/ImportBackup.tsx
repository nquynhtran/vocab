import { useId, useRef, useState, type ChangeEvent } from 'react'
import { MAX_BACKUP_FILE_BYTES, parseBackupFile, type Backup } from '../../domain/backup.ts'
import { plural } from '../../shared/deleteMessages.ts'
import { importProblems, type ImportProblems } from './importErrors.ts'

interface ImportBackupProps {
  /**
   * Writes the backup and reloads the page. Reports its own errors on the page: once anything
   * is stored the page no longer shows this form, so an error kept here would vanish with it.
   */
  onImport: (backup: Backup) => Promise<void>
}

/**
 * Shown while the account is empty: moving local data to the cloud is importing the file that
 * Export JSON made in the local build (decision #46). That file is also the safety copy.
 */
export function ImportBackup({ onImport }: ImportBackupProps) {
  const inputId = useId()
  const [backup, setBackup] = useState<Backup>()
  const [problems, setProblems] = useState<ImportProblems>()
  const [busy, setBusy] = useState(false)
  const latestPick = useRef(0)

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    setBackup(undefined)
    setProblems(undefined)
    // A large file read earlier may finish after a later pick (or a cancelled one); only the
    // latest pick counts.
    const pick = ++latestPick.current
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > MAX_BACKUP_FILE_BYTES) {
      setProblems({ shown: ['This file is larger than 5 MB, too big to be a backup'], hidden: 0 })
      return
    }
    try {
      const parsed = parseBackupFile(await file.text())
      if (pick === latestPick.current) setBackup(parsed)
    } catch (error) {
      if (pick === latestPick.current) setProblems(importProblems(error))
    }
  }

  async function handleImport() {
    if (!backup) return
    setBusy(true)
    try {
      await onImport(backup)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby={`${inputId}-heading`} className="backup">
      <h2 id={`${inputId}-heading`}>Import a backup</h2>
      <p className="muted">
        Your account is empty. To bring in your words, choose a file made with Export JSON.
      </p>
      <label htmlFor={inputId}>Backup file</label>
      <input
        id={inputId}
        type="file"
        accept=".json,application/json"
        disabled={busy}
        // Cleared when the picker opens, not after reading, so the chosen name stays visible
        // while picking the same file again (fixed after an error) still fires `change`.
        onClick={(event) => {
          event.currentTarget.value = ''
        }}
        onChange={(event) => void handleFile(event)}
      />
      {backup && (
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() => void handleImport()}
        >
          {`Import ${plural(backup.folders.length, 'folder')}, ${plural(backup.files.length, 'file')}, ${plural(backup.terms.length, 'term')}`}
        </button>
      )}
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
    </section>
  )
}
