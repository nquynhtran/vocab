import type { Backup } from '../../domain/backup.ts'

/** Named by the local calendar day, which is the day the user sees on their clock. */
export function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `vocab-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
}

/** Hands the backup to the browser as a file download; nothing leaves the device. */
export function downloadBackup(backup: Backup, fileName: string): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  // Revoked a moment later: some browsers start reading the blob only after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
