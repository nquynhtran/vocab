import type { Backup } from '../domain/backup.ts'
import type { AnswerRecord } from '../domain/learn/answer.ts'
import type { ChoiceSource } from '../domain/learn/choices.ts'
import type {
  FileInput,
  FileNotesInput,
  Folder,
  FolderInput,
  StudyDay,
  Term,
  TermInput,
  TermProgress,
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
  extends
    FolderRepository,
    FileRepository,
    TermRepository,
    LearnRepository,
    StudyDayRepository,
    BackupRepository {}

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
  /**
   * Replaces the notes; blank notes remove them. Touches nothing but the notes and `updatedAt`,
   * so a rename on another device is never undone by it, nor it by a rename (#65).
   */
  updateFileNotes(id: string, input: FileNotesInput): Promise<VocabFile>
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

/** Everything a Learn session needs, read in one snapshot. */
export interface LearnData {
  file: VocabFile
  /** Newest first, like `listTerms`. */
  terms: Term[]
  /** Only terms studied before; a term without a row counts as box 1. In no particular order. */
  progress: TermProgress[]
  /** Every term in the other files of the same folder (decision #54). In no particular order. */
  distractors: ChoiceSource[]
}

/** docs/learn-algorithm.md#ghi-kết-quả */
export interface LearnRepository {
  /** `undefined` when the file does not exist. Never cut at the cloud's row limit. */
  getLearnData(fileId: string): Promise<LearnData | undefined>
  /**
   * Applies one answer to the term's progress and counts it for its study day, in one
   * transaction (`progressAfter`). Sending the same record again changes nothing (#51), so a
   * retry after a `ConnectionError` is always safe. A term that no longer exists is a no-op.
   * `ValidationError` for an invalid record, e.g. a wrong answer that promotes.
   */
  recordAnswer(answer: AnswerRecord): Promise<void>
}

export interface StudyDayRepository {
  /** Every study day, oldest first. Never cut at the cloud's row limit (decision #73). */
  listStudyDays(): Promise<StudyDay[]>
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
