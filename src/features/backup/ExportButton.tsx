import { useState } from 'react'
import { ActionError } from '../../shared/PageStatus.tsx'
import { useRepository } from '../../shared/repositoryContext.ts'
import { errorMessage } from '../../shared/errorMessage.ts'
import { backupFileName, downloadBackup } from './backupFile.ts'

export function ExportButton() {
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
      <p className="muted">Download all folders, files and terms as a JSON file.</p>
      <button type="button" className="button" disabled={busy} onClick={() => void handleExport()}>
        Export JSON
      </button>
      <ActionError message={error} />
    </section>
  )
}
