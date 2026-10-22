import { BACKUP_SCHEMA_VERSION, type Backup } from '../domain/backup.ts'
import { DuplicateNameError, EntityNotFoundError, parseOrThrow } from '../domain/errors.ts'
import { isMastered } from '../domain/mastery.ts'
import {
  FileInputSchema,
  FolderInputSchema,
  TermInputSchema,
  type FileInput,
  type Folder,
  type FolderInput,
  type StudyDay,
  type Term,
  type TermInput,
  type TermProgress,
  type VocabFile,
} from '../domain/schemas.ts'
import { toKey } from '../domain/text.ts'
import type { FileRow, FolderRow, TermRow, VocabDb } from './db.ts'
import { defaultDeps, type RepositoryDeps } from './deps.ts'
import { byLocation, byName, newestFirst } from './ordering.ts'
import type { FolderContents, Repository, TermLocation } from './repository.ts'

/**
 * Every write is one transaction that also covers the parent table: the parent check and the
 * write then cannot interleave with a delete from another tab, so no orphan rows appear.
 */
export class DexieRepository implements Repository {
  private readonly db: VocabDb
  private readonly deps: RepositoryDeps

  constructor(db: VocabDb, deps: RepositoryDeps = defaultDeps) {
    this.db = db
    this.deps = deps
  }

  // ---- Folders ----

  async listFolders(): Promise<Folder[]> {
    const rows = await this.db.folders.toArray()
    return rows.map(toFolder).toSorted(byName)
  }

  async getFolder(id: string): Promise<Folder | undefined> {
    const row = await this.db.folders.get(id)
    return row && toFolder(row)
  }

  async getFolderContents(id: string): Promise<FolderContents | undefined> {
    const { folders, files, terms, progress } = this.db
    // One read transaction so the list and its counts never mix states from before and after
    // another tab's write.
    return this.db.transaction('r', [folders, files, terms, progress], async () => {
      const folderRow = await folders.get(id)
      if (!folderRow) return undefined
      const fileRows = await files.where('folderId').equals(id).toArray()
      const termRows = await terms
        .where('fileId')
        .anyOf(fileRows.map((file) => file.id))
        .toArray()
      const progressRows = await progress.bulkGet(termRows.map((term) => term.id))

      const counts = new Map<string, { termCount: number; masteredCount: number }>()
      termRows.forEach((term, index) => {
        const current = counts.get(term.fileId) ?? { termCount: 0, masteredCount: 0 }
        counts.set(term.fileId, {
          termCount: current.termCount + 1,
          masteredCount: current.masteredCount + (isMastered(progressRows[index]) ? 1 : 0),
        })
      })
      return {
        folder: toFolder(folderRow),
        files: fileRows.toSorted(byName).map((row) => ({
          ...toFile(row),
          ...(counts.get(row.id) ?? { termCount: 0, masteredCount: 0 }),
        })),
      }
    })
  }

  async createFolder(input: FolderInput): Promise<Folder> {
    const { name } = parseOrThrow(FolderInputSchema, input)
    const now = this.timestamp()
    const row: FolderRow = {
      id: this.deps.newId(),
      name,
      nameKey: toKey(name),
      createdAt: now,
      updatedAt: now,
    }
    await this.db.transaction('rw', this.db.folders, async () => {
      await this.assertFolderNameFree(row.nameKey, row.id)
      await this.db.folders.add(row)
    })
    return toFolder(row)
  }

  async renameFolder(id: string, input: FolderInput): Promise<Folder> {
    const { name } = parseOrThrow(FolderInputSchema, input)
    const nameKey = toKey(name)
    return this.db.transaction('rw', this.db.folders, async () => {
      const current = await this.db.folders.get(id)
      if (!current) throw new EntityNotFoundError('folder', id)
      await this.assertFolderNameFree(nameKey, id)
      const row: FolderRow = { ...current, name, nameKey, updatedAt: this.timestamp() }
      await this.db.folders.put(row)
      return toFolder(row)
    })
  }

  async deleteFolder(id: string): Promise<void> {
    const { folders, files, terms, progress } = this.db
    await this.db.transaction('rw', [folders, files, terms, progress], async () => {
      const fileIds = await files.where('folderId').equals(id).primaryKeys()
      const termIds = await terms.where('fileId').anyOf(fileIds).primaryKeys()
      await progress.bulkDelete(termIds)
      await terms.bulkDelete(termIds)
      await files.bulkDelete(fileIds)
      await folders.delete(id)
    })
  }

  // ---- Files ----

  async listFiles(folderId: string): Promise<VocabFile[]> {
    const rows = await this.db.files.where('folderId').equals(folderId).toArray()
    return rows.map(toFile).toSorted(byName)
  }

  async getFile(id: string): Promise<VocabFile | undefined> {
    const row = await this.db.files.get(id)
    return row && toFile(row)
  }

  async createFile(folderId: string, input: FileInput): Promise<VocabFile> {
    const { name } = parseOrThrow(FileInputSchema, input)
    const now = this.timestamp()
    const row: FileRow = {
      id: this.deps.newId(),
      folderId,
      name,
      nameKey: toKey(name),
      createdAt: now,
      updatedAt: now,
    }
    await this.db.transaction('rw', [this.db.folders, this.db.files], async () => {
      await this.assertFolderExists(folderId)
      await this.assertFileNameFree(folderId, row.nameKey, row.id)
      await this.db.files.add(row)
    })
    return toFile(row)
  }

  async renameFile(id: string, input: FileInput): Promise<VocabFile> {
    const { name } = parseOrThrow(FileInputSchema, input)
    const nameKey = toKey(name)
    return this.db.transaction('rw', [this.db.folders, this.db.files], async () => {
      const current = await this.db.files.get(id)
      if (!current) throw new EntityNotFoundError('file', id)
      await this.assertFolderExists(current.folderId)
      await this.assertFileNameFree(current.folderId, nameKey, id)
      const row: FileRow = { ...current, name, nameKey, updatedAt: this.timestamp() }
      await this.db.files.put(row)
      return toFile(row)
    })
  }

  async deleteFile(id: string): Promise<void> {
    const { files, terms, progress } = this.db
    await this.db.transaction('rw', [files, terms, progress], async () => {
      const termIds = await terms.where('fileId').equals(id).primaryKeys()
      await progress.bulkDelete(termIds)
      await terms.bulkDelete(termIds)
      await files.delete(id)
    })
  }

  // ---- Terms ----

  async listTerms(fileId: string): Promise<Term[]> {
    const rows = await this.db.terms.where('fileId').equals(fileId).toArray()
    return rows.map(toTerm).toSorted(newestFirst)
  }

  async createTerm(fileId: string, input: TermInput): Promise<Term> {
    const content = parseOrThrow(TermInputSchema, input)
    const now = this.timestamp()
    const row = toTermRow(
      { id: this.deps.newId(), fileId, createdAt: now, updatedAt: now },
      content,
    )
    await this.db.transaction('rw', [this.db.files, this.db.terms], async () => {
      await this.assertFileExists(fileId)
      await this.db.terms.add(row)
    })
    return toTerm(row)
  }

  async updateTerm(id: string, input: TermInput): Promise<Term> {
    const content = parseOrThrow(TermInputSchema, input)
    return this.db.transaction('rw', [this.db.files, this.db.terms], async () => {
      const current = await this.db.terms.get(id)
      if (!current) throw new EntityNotFoundError('term', id)
      await this.assertFileExists(current.fileId)
      // Built from scratch and written with put, so a removed optional field is really removed.
      const row = toTermRow(
        {
          id,
          fileId: current.fileId,
          createdAt: current.createdAt,
          updatedAt: this.timestamp(),
        },
        content,
      )
      await this.db.terms.put(row)
      return toTerm(row)
    })
  }

  async deleteTerm(id: string): Promise<void> {
    await this.db.transaction('rw', [this.db.terms, this.db.progress], async () => {
      await this.db.progress.delete(id)
      await this.db.terms.delete(id)
    })
  }

  async findTermsByWord(word: string, excludeTermId?: string): Promise<TermLocation[]> {
    const wordKey = toKey(word)
    if (!wordKey) return []
    const { folders, files, terms } = this.db
    return this.db.transaction('r', [folders, files, terms], async () => {
      const matches = (await terms.where('wordKey').equals(wordKey).toArray()).filter(
        (term) => term.id !== excludeTermId,
      )
      const fileRows = await files.bulkGet([...new Set(matches.map((term) => term.fileId))])
      const fileById = new Map(fileRows.flatMap((file) => (file ? [[file.id, file]] : [])))
      const folderRows = await folders.bulkGet([
        ...new Set([...fileById.values()].map((f) => f.folderId)),
      ])
      const folderById = new Map(
        folderRows.flatMap((folder) => (folder ? [[folder.id, folder]] : [])),
      )

      return matches
        .flatMap((term): TermLocation[] => {
          const file = fileById.get(term.fileId)
          const folder = file && folderById.get(file.folderId)
          if (!file || !folder) return []
          return [
            { termId: term.id, fileId: file.id, folderName: folder.name, fileName: file.name },
          ]
        })
        .toSorted(byLocation)
    })
  }

  // ---- Backup ----

  async exportBackup(): Promise<Backup> {
    const { folders, files, terms, progress, studyDays } = this.db
    return this.db.transaction('r', [folders, files, terms, progress, studyDays], async () => ({
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: this.timestamp(),
      folders: (await folders.toArray()).map(toFolder),
      files: (await files.toArray()).map(toFile),
      terms: (await terms.toArray()).map(toTerm),
      progress: (await progress.toArray()).map(toProgress),
      studyDays: (await studyDays.toArray()).map(toStudyDay),
    }))
  }

  // ---- Helpers (must run inside the caller's transaction) ----

  private timestamp(): string {
    return this.deps.now().toISOString()
  }

  private async assertFolderExists(id: string): Promise<void> {
    if (!(await this.db.folders.get(id))) throw new EntityNotFoundError('folder', id)
  }

  private async assertFileExists(id: string): Promise<void> {
    if (!(await this.db.files.get(id))) throw new EntityNotFoundError('file', id)
  }

  /** `selfId` lets a rename change only the letter case of its own name. */
  private async assertFolderNameFree(nameKey: string, selfId: string): Promise<void> {
    const existing = await this.db.folders.where('nameKey').equals(nameKey).first()
    if (existing && existing.id !== selfId) throw new DuplicateNameError('folder', existing.name)
  }

  private async assertFileNameFree(
    folderId: string,
    nameKey: string,
    selfId: string,
  ): Promise<void> {
    const existing = await this.db.files
      .where('[folderId+nameKey]')
      .equals([folderId, nameKey])
      .first()
    if (existing && existing.id !== selfId) throw new DuplicateNameError('file', existing.name)
  }
}

// Mappers pick fields explicitly so storage-only keys never leak to callers.

function toFolder({ id, name, createdAt, updatedAt }: FolderRow): Folder {
  return { id, name, createdAt, updatedAt }
}

function toFile({ id, folderId, name, createdAt, updatedAt }: FileRow): VocabFile {
  return { id, folderId, name, createdAt, updatedAt }
}

function toTerm({
  id,
  fileId,
  word,
  partOfSpeech,
  meaning,
  example,
  createdAt,
  updatedAt,
}: TermRow): Term {
  return {
    id,
    fileId,
    word,
    ...(partOfSpeech !== undefined && { partOfSpeech }),
    meaning,
    ...(example !== undefined && { example }),
    createdAt,
    updatedAt,
  }
}

function toProgress({
  termId,
  box,
  correctCount,
  wrongCount,
  lastWrongAt,
  lastStudiedAt,
}: TermProgress): TermProgress {
  return {
    termId,
    box,
    correctCount,
    wrongCount,
    ...(lastWrongAt !== undefined && { lastWrongAt }),
    ...(lastStudiedAt !== undefined && { lastStudiedAt }),
  }
}

function toStudyDay({ date, answeredCount }: StudyDay): StudyDay {
  return { date, answeredCount }
}

type TermContent = Pick<Term, 'word' | 'partOfSpeech' | 'meaning' | 'example'>
type TermMeta = Pick<Term, 'id' | 'fileId' | 'createdAt' | 'updatedAt'>

function toTermRow(meta: TermMeta, { word, partOfSpeech, meaning, example }: TermContent): TermRow {
  return {
    ...meta,
    word,
    wordKey: toKey(word),
    // Optional fields are omitted rather than stored as undefined, so stored rows match what a
    // backup contains.
    ...(partOfSpeech !== undefined && { partOfSpeech }),
    meaning,
    ...(example !== undefined && { example }),
  }
}
