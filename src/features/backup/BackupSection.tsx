import { useState } from 'react'
import { ActionError } from '../../shared/PageStatus.tsx'
import { useRepository } from '../../shared/repositoryContext.ts'
import { errorMessage } from '../../shared/errorMessage.ts'
import { backupFileName, downloadBackup } from './backupFile.ts'
import { RestoreBackup } from './RestoreBackup.tsx'

interface BackupSectionProps {
  /** Reloads what the page shows after a restore (folders and streak). */
  onRestored: () => void
}

/** Always shown at the bottom of Home, whether or not there is data yet (decision #77). */
export function BackupSection({ onRestored }: BackupSectionProps) {
  const repository = useRepository()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  async function handleExport() {
    setBusy(true)
    setError(undefined)
    try {
      downloadBackup(await repository.exportBackup(), backupFileName(new Date()))
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="backup-heading" className="backup">
      <h2 id="backup-heading">Backup</h2>
      <p className="muted">
        Download all folders, files, terms, learning progress and study days as a JSON file.
      </p>
      <button type="button" className="button" disabled={busy} onClick={() => void handleExport()}>
        Export JSON
      </button>
      <ActionError message={error} />
      <RestoreBackup onRestored={onRestored} />
    </section>
  )
}
