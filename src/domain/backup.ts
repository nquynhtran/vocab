import { z } from 'zod'
import { firstDifference } from './difference.ts'
import { parseOrThrow, ValidationError } from './errors.ts'
import {
  FolderSchema,
  StudyDaySchema,
  TermProgressSchema,
  TermSchema,
  TimestampSchema,
  VocabFileSchema,
} from './schemas.ts'
import { toKey } from './text.ts'

/** Bump with a migration for older files whenever the backup shape changes (docs/data-model.md). */
export const BACKUP_SCHEMA_VERSION = 1

export const BackupSchema = z.object({
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  exportedAt: TimestampSchema,
  folders: z.array(FolderSchema),
  files: z.array(VocabFileSchema),
  terms: z.array(TermSchema),
  progress: z.array(TermProgressSchema),
  studyDays: z.array(StudyDaySchema),
})

export type Backup = z.output<typeof BackupSchema>

/**
 * Validates an untrusted backup (a file, or a snapshot about to be uploaded) in full before
 * anything is written: shape, references between tables, and duplicates under `toKey`, which
 * the per-record schemas cannot see. Checks run in stages and stop at the first failing stage:
 * schema errors and integrity problems are all listed, a changed value only the first one.
 * Data that the schemas would change (unnormalized text, unknown fields) is rejected, so the
 * returned value always equals the input apart from absent vs `undefined` fields.
 */
export function validateBackup(value: unknown): Backup {
  const version = (value as { schemaVersion?: unknown } | null)?.schemaVersion
  if (typeof version === 'number' && version > BACKUP_SCHEMA_VERSION) {
    throw new ValidationError({
      schemaVersion: ['This backup is from a newer version. Reload the page to update the app.'],
    })
  }
  const backup = parseOrThrow(BackupSchema, value)
  // The schemas normalize text and drop blank fields. A backup is written only by this app,
  // so any change means a bug or a hand edit: reject it instead of silently fixing the data
  // (decision #35), otherwise stored text and its `toKey` columns could disagree.
  const changed = firstDifference(value, backup)
  if (changed !== undefined) {
    throw new ValidationError({ [changed || '_']: ['Unexpected or non-normalized value'] })
  }
  const problems = integrityProblems(backup)
  if (Object.keys(problems).length > 0) throw new ValidationError(problems)
  return backup
}

function integrityProblems({ folders, files, terms, progress, studyDays }: Backup) {
  const problems: Record<string, string[]> = {}
  const report = (path: string, message: string) => {
    problems[path] = [...(problems[path] ?? []), message]
  }
  /** Reports every item whose key was already seen earlier in the same list. */
  const checkUnique = <T>(
    table: string,
    items: readonly T[],
    keyOf: (item: T) => string,
    message: (item: T) => string,
  ) => {
    const seen = new Set<string>()
    items.forEach((item, index) => {
      const key = keyOf(item)
      if (seen.has(key)) report(`${table}.${index}`, message(item))
      seen.add(key)
    })
  }

  checkUnique(
    'folders',
    folders,
    (f) => f.id,
    (f) => `Duplicate folder id ${f.id}`,
  )
  checkUnique(
    'files',
    files,
    (f) => f.id,
    (f) => `Duplicate file id ${f.id}`,
  )
  checkUnique(
    'terms',
    terms,
    (t) => t.id,
    (t) => `Duplicate term id ${t.id}`,
  )
  checkUnique(
    'progress',
    progress,
    (p) => p.termId,
    (p) => `Duplicate progress for ${p.termId}`,
  )
  checkUnique(
    'studyDays',
    studyDays,
    (d) => d.date,
    (d) => `Duplicate study day ${d.date}`,
  )
  checkUnique(
    'folders',
    folders,
    (f) => toKey(f.name),
    (f) => `A folder named "${f.name}" appears twice`,
  )
  checkUnique(
    'files',
    files,
    // JSON keeps the pair unambiguous whatever characters the name contains.
    (f) => JSON.stringify([f.folderId, toKey(f.name)]),
    (f) => `A file named "${f.name}" appears twice in one folder`,
  )

  const folderIds = new Set(folders.map((f) => f.id))
  const fileIds = new Set(files.map((f) => f.id))
  const termIds = new Set(terms.map((t) => t.id))
  files.forEach((file, index) => {
    if (!folderIds.has(file.folderId)) report(`files.${index}`, `Unknown folder ${file.folderId}`)
  })
  terms.forEach((term, index) => {
    if (!fileIds.has(term.fileId)) report(`terms.${index}`, `Unknown file ${term.fileId}`)
  })
  progress.forEach((entry, index) => {
    if (!termIds.has(entry.termId)) report(`progress.${index}`, `Unknown term ${entry.termId}`)
  })
  return problems
}
