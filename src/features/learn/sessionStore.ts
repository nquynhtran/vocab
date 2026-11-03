import { SavedSessionSchema, type SavedSession } from '../../domain/learn/resume.ts'

/**
 * The session stopped halfway, per file, on this device only (#58). localStorage can be missing
 * or throw (private mode, blocked storage, full): Learn then works as before, without resuming.
 */
const keyFor = (fileId: string) => `vocab-learn:${fileId}`

/** `undefined` when there is none, or it cannot be read or trusted. */
export function readSavedSession(fileId: string): SavedSession | undefined {
  try {
    const raw = localStorage.getItem(keyFor(fileId))
    if (raw === null) return undefined
    const parsed = SavedSessionSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : undefined
  } catch {
    return undefined
  }
}

/** A failed write removes the older copy: resuming from further back than the stop is worse. */
export function writeSavedSession(fileId: string, saved: SavedSession): void {
  try {
    localStorage.setItem(keyFor(fileId), JSON.stringify(saved))
  } catch {
    clearSavedSession(fileId)
  }
}

export function clearSavedSession(fileId: string): void {
  try {
    localStorage.removeItem(keyFor(fileId))
  } catch {
    // Storage unusable: there is nothing to remove either.
  }
}
