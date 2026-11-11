import { useState } from 'react'
import { ActionError } from '../../shared/PageStatus.tsx'
import { useRepository } from '../../shared/repositoryContext.ts'
import { errorMessage } from '../../shared/errorMessage.ts'
import { backupFileName, downloadBackup } from './backupFile.ts'
import { RestoreBackup } from './RestoreBackup.tsx'

/**
 * On Settings, whether or not there is data yet (#77, #86). Nothing on that page shows stored
 * data, so a restore reloads nothing; Home loads afresh when opened.
 */
export function BackupSection() {
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
    <section aria-labelledby="backup-heading" className="settings-section backup">
      <h2 id="backup-heading">Backup</h2>
      <p className="muted">
        Download all folders, files, terms, learning progress and study days as a JSON file.
      </p>
      <button type="button" className="button" disabled={busy} onClick={() => void handleExport()}>
        Export JSON
      </button>
      <ActionError message={error} />
      <RestoreBackup />
    </section>
  )
}
