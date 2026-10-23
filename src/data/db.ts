import Dexie, { type DexieOptions, type EntityTable } from 'dexie'
import type { Folder, StudyDay, Term, TermProgress, VocabFile } from '../domain/schemas.ts'

/**
 * Never rename: IndexedDB is scoped to the origin nquynhtran.github.io, which every GitHub
 * Pages repo of the account shares, so a generic name could collide with another project.
 */
export const DB_NAME = 'vocab-app'

// Comparison keys exist only in stored rows; the domain types and backups never carry them.
export type FolderRow = Folder & { nameKey: string }
export type FileRow = VocabFile & { nameKey: string }
export type TermRow = Term & { wordKey: string }
export interface MetaRow {
  key: string
  value: string
}

export interface VocabDbOptions extends Pick<DexieOptions, 'indexedDB' | 'IDBKeyRange'> {
  /** Called after another tab opened a newer schema version and this connection was closed. */
  onVersionChange?: () => void
}

export class VocabDb extends Dexie {
  declare folders: EntityTable<FolderRow, 'id'>
  declare files: EntityTable<FileRow, 'id'>
  declare terms: EntityTable<TermRow, 'id'>
  declare progress: EntityTable<TermProgress, 'termId'>
  declare studyDays: EntityTable<StudyDay, 'date'>
  declare meta: EntityTable<MetaRow, 'key'>

  constructor({ onVersionChange, ...dexieOptions }: VocabDbOptions = {}) {
    super(DB_NAME, dexieOptions)

    // Released schema versions are never edited; changes go into a new version + migration.
    this.version(1).stores({
      folders: 'id, &nameKey',
      files: 'id, folderId, &[folderId+nameKey]',
      terms: 'id, fileId, wordKey',
      progress: 'termId',
      studyDays: 'date',
      meta: 'key',
    })
    // Same indexes as v1. Bumped when terms gained `partOfSpeech` (decision #32) so tabs still
    // running older code get `versionchange` and reload: their updateTerm rebuilds the whole
    // row and would silently drop the new field. Any change to stored shape needs a bump.
    this.version(2).stores({
      folders: 'id, &nameKey',
      files: 'id, folderId, &[folderId+nameKey]',
      terms: 'id, fileId, wordKey',
      progress: 'termId',
      studyDays: 'date',
      meta: 'key',
    })
    // Same indexes again. Opened by the cloud build at startup (decision #33), so tabs still
    // running the local-only build get `versionchange` and reload into the cloud build instead
    // of saving words to IndexedDB that never reach the cloud.
    this.version(3).stores({
      folders: 'id, &nameKey',
      files: 'id, folderId, &[folderId+nameKey]',
      terms: 'id, fileId, wordKey',
      progress: 'termId',
      studyDays: 'date',
      meta: 'key',
    })

    // Dexie's default handler closes but allows auto-reopening, which would let this tab's old
    // code write rows in the old shape into the upgraded database. Returning false skips it.
    this.on('versionchange', () => {
      this.close({ disableAutoOpen: true })
      onVersionChange?.()
      return false
    })
  }
}
