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

/**
 * The only way the UI touches stored data, so phase 7 can swap Dexie for Supabase.
 * Rules: docs/architecture.md#quy-tắc-repository. Constraints: docs/data-model.md.
 *
 * Errors: `ValidationError` for bad input, `DuplicateNameError` for a taken name,
 * `EntityNotFoundError` when renaming/updating (or creating inside) something that no longer exists.
 * Deleting something that no longer exists is a no-op.
 */
export interface Repository {
  /** Sorted by `compareNames`. */
  listFolders(): Promise<Folder[]>
  getFolder(id: string): Promise<Folder | undefined>
  createFolder(input: FolderInput): Promise<Folder>
  renameFolder(id: string, input: FolderInput): Promise<Folder>
  /** Also deletes its files, their terms and the terms' progress. */
  deleteFolder(id: string): Promise<void>

  /** Sorted by `compareNames`. */
  listFiles(folderId: string): Promise<VocabFile[]>
  getFile(id: string): Promise<VocabFile | undefined>
  createFile(folderId: string, input: FileInput): Promise<VocabFile>
  renameFile(id: string, input: FileInput): Promise<VocabFile>
  /** Also deletes its terms and their progress. */
  deleteFile(id: string): Promise<void>

  /** Newest first. */
  listTerms(fileId: string): Promise<Term[]>
  createTerm(fileId: string, input: TermInput): Promise<Term>
  /** Replaces the content; the learning progress is kept. */
  updateTerm(id: string, input: TermInput): Promise<Term>
  /** Also deletes its progress. */
  deleteTerm(id: string): Promise<void>

  /** Terms whose word matches `word` (compared with `toKey`), in any file. */
  findTermsByWord(word: string, excludeTermId?: string): Promise<TermLocation[]>
}
