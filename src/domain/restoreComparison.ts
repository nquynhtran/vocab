import type { Backup } from './backup.ts'

/** What the restore screen shows for one side, current data or the chosen file. */
export interface BackupSummary {
  folders: number
  files: number
  terms: number
  /** Latest `updatedAt` of a folder, file or term; absent when there are none. */
  lastEdit?: string
  /** Latest study day (`YYYY-MM-DD`); absent when there are none. */
  lastStudyDay?: string
}

export interface RestoreComparison {
  current: BackupSummary
  backup: BackupSummary
  /** No folder and no study day: nothing would be lost, so the screen skips its warnings. */
  currentIsEmpty: boolean
  /** Current data was edited or studied after the file's latest edit or study day. */
  currentIsNewer: boolean
  /** Study days in current data but not in the file: replacing removes them (#76). */
  removedStudyDays: number
}

/** Compares current data with a backup about to replace it (docs/backup.md, step 3). */
export function compareForRestore(current: Backup, backup: Backup): RestoreComparison {
  const currentSummary = summarize(current)
  const backupSummary = summarize(backup)
  const backupDays = new Set(backup.studyDays.map((day) => day.date))
  return {
    current: currentSummary,
    backup: backupSummary,
    currentIsEmpty: current.folders.length === 0 && current.studyDays.length === 0,
    currentIsNewer:
      isAfter(currentSummary.lastEdit, backupSummary.lastEdit, Date.parse) ||
      isAfter(currentSummary.lastStudyDay, backupSummary.lastStudyDay, (day) => day),
    removedStudyDays: current.studyDays.filter((day) => !backupDays.has(day.date)).length,
  }
}

function summarize({ folders, files, terms, studyDays }: Backup): BackupSummary {
  const edits = [...folders, ...files, ...terms].map((item) => item.updatedAt)
  return {
    folders: folders.length,
    files: files.length,
    terms: terms.length,
    lastEdit: latest(edits, Date.parse),
    // `YYYY-MM-DD` sorts as text.
    lastStudyDay: latest(
      studyDays.map((day) => day.date),
      (day) => day,
    ),
  }
}

// Timestamps are compared as instants, not text: a valid file may carry any number of decimals,
// and `08:00:00Z` sorts after `08:00:00.500Z` as text.
function latest<K>(values: readonly string[], key: (value: string) => K): string | undefined {
  return values.reduce<string | undefined>(
    (best, value) => (best === undefined || key(value) > key(best) ? value : best),
    undefined,
  )
}

/** A value on one side and none on the other counts as later. */
function isAfter<K>(
  value: string | undefined,
  other: string | undefined,
  key: (value: string) => K,
): boolean {
  if (value === undefined) return false
  return other === undefined || key(value) > key(other)
}
