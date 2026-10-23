import type { Backup } from '../domain/backup.ts'
import type {
  FileInput,
  Folder,
  FolderInput,
  Term,
  TermInput,
  VocabFile,
} from '../domain/schemas.ts'

/** Where a term with the same word already lives, for the "Already in Folder / File" warning. */
export interface TermLocation {
  termId: string
  fileId: string
  folderName: string
  fileName: string
}

/** A file with the numbers shown in its folder and in delete confirmations. */
export interface FileSummary extends VocabFile {
  termCount: number
  /** Terms whose progress counts as mastered (`isMastered`). */
  masteredCount: number
}

export interface FolderContents {
  folder: Folder
  /** Every file of the folder, empty ones included, sorted by `compareNames`. */
  files: FileSummary[]
}

/**
 * The only way the UI touches stored data, so phase 7 can swap Dexie for Supabase.
 * Rules: docs/architecture.md#quy-tắc-repository. Constraints: docs/data-model.md.
 *
 * Split per entity (Interface Segregation): a screen or a test fake depends only on the part
 * it uses, e.g. `FolderRepository`. One implementation still provides all of them.
 *
 * Errors: `ValidationError` for bad input, `DuplicateNameError` for a taken name,
 * `EntityNotFoundError` when renaming/updating (or creating inside) something that no longer exists.
 * Deleting something that no longer exists is a no-op.
 */
export interface Repository
  extends FolderRepository, FileRepository, TermRepository, BackupRepository {}

export interface FolderRepository {
  /** Sorted by `compareNames`. */
  listFolders(): Promise<Folder[]>
  getFolder(id: string): Promise<Folder | undefined>
  /** Read in one snapshot, so the counts always match the file list. */
  getFolderContents(id: string): Promise<FolderContents | undefined>
  createFolder(input: FolderInput): Promise<Folder>
  renameFolder(id: string, input: FolderInput): Promise<Folder>
  /** Also deletes its files, their terms and the terms' progress. */
  deleteFolder(id: string): Promise<void>
}

export interface FileRepository {
  /** Sorted by `compareNames`. */
  listFiles(folderId: string): Promise<VocabFile[]>
  getFile(id: string): Promise<VocabFile | undefined>
  createFile(folderId: string, input: FileInput): Promise<VocabFile>
  renameFile(id: string, input: FileInput): Promise<VocabFile>
  /** Also deletes its terms and their progress. */
  deleteFile(id: string): Promise<void>
}

export interface TermRepository {
  /** Newest first. */
  listTerms(fileId: string): Promise<Term[]>
  createTerm(fileId: string, input: TermInput): Promise<Term>
  /** Replaces the content; the learning progress is kept. */
  updateTerm(id: string, input: TermInput): Promise<Term>
  /** Also deletes its progress. */
  deleteTerm(id: string): Promise<void>
  /**
   * Terms whose word matches `word` (compared with `toKey`), in any file including the same one.
   * Sorted by folder name, then file name (`compareNames`), then term id.
   */
  findTermsByWord(word: string, excludeTermId?: string): Promise<TermLocation[]>
}

export interface BackupRepository {
  /**
   * Everything the user owns, read in one snapshot, in the backup format. Not validated here:
   * a safety copy must still download when some stored record is off; import validates it.
   */
  exportBackup(): Promise<Backup>
  /**
   * Writes a whole backup into empty storage, all or nothing, keeping its ids and timestamps
   * (moving local data to the cloud, decision #33). Validates it again (`validateBackup`).
   * Throws `DataAlreadyExistsError` when any folder or study day is already stored, so a second
   * attempt never duplicates anything. Replacing existing data is a different operation (#38).
   */
  importIntoEmpty(backup: Backup): Promise<void>
}
