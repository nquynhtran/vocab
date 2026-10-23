import type { SupabaseClient } from '@supabase/supabase-js'
import { BACKUP_SCHEMA_VERSION, type Backup } from '../domain/backup.ts'
import { DuplicateNameError, EntityNotFoundError, parseOrThrow } from '../domain/errors.ts'
import {
  FileInputSchema,
  FolderInputSchema,
  FolderSchema,
  IdSchema,
  StudyDaySchema,
  TermInputSchema,
  TermProgressSchema,
  TermSchema,
  VocabFileSchema,
  type FileInput,
  type Folder,
  type FolderInput,
  type Term,
  type TermInput,
  type VocabFile,
} from '../domain/schemas.ts'
import { toKey } from '../domain/text.ts'
import { defaultDeps, type RepositoryDeps } from './deps.ts'
import { summarizeFiles } from './fileSummaries.ts'
import { byLocation, byName, newestFirst } from './ordering.ts'
import type { FolderContents, Repository, TermLocation } from './repository.ts'
import { runRequest, type ConstraintHandler, type SupabaseResponse } from './supabaseRequest.ts'
import {
  arrayField,
  convertRow,
  fileToRow,
  folderToRow,
  nameColumns,
  objectField,
  parseRow,
  termContentToRow,
  termToRow,
} from './supabaseRows.ts'

/**
 * PostgREST's `max_rows` (supabase/config.toml, same default on the cloud). A plain select is cut
 * there without an error, so reaching it is reported instead. Lists that can realistically grow
 * past it (terms of a file or folder) go through RPCs returning jsonb, which are not cut.
 */
export const MAX_ROWS = 1000

/** The per-term part of `get_folder_contents`: only what the counts need. */
const TermBoxSchema = TermSchema.pick({ fileId: true }).extend({
  box: TermProgressSchema.shape.box.optional(),
})

/**
 * The same contract as DexieRepository, over Supabase (docs/cloud-sync.md). Every request is its
 * own transaction, so nothing is checked before writing: the database constraints decide, and
 * their errors are translated (unique → DuplicateNameError, foreign key → EntityNotFoundError).
 * Rows read back are validated (decision #35), except by exportBackup.
 */
export class SupabaseRepository implements Repository {
  private readonly client: SupabaseClient
  private readonly deps: RepositoryDeps

  constructor(client: SupabaseClient, deps: RepositoryDeps = defaultDeps) {
    this.client = client
    this.deps = deps
  }

  // ---- Folders ----

  async listFolders(): Promise<Folder[]> {
    const rows = await this.run(this.client.from('folders').select('*'))
    return limited(rows, 'folders')
      .map((row, i) => parseRow(FolderSchema, row, `folders ${i}`))
      .toSorted(byName)
  }

  async getFolder(id: string): Promise<Folder | undefined> {
    if (!isId(id)) return undefined
    const row = await this.run(this.client.from('folders').select('*').eq('id', id).maybeSingle())
    return row === null ? undefined : parseRow(FolderSchema, row, `folders ${id}`)
  }

  async getFolderContents(id: string): Promise<FolderContents | undefined> {
    if (!isId(id)) return undefined
    // One RPC: a single statement reads one snapshot, and its jsonb result is not cut at MAX_ROWS.
    const result = await this.run(this.client.rpc('get_folder_contents', { p_folder_id: id }))
    if (result === null) return undefined
    const where = `folder contents ${id}`
    const folder = parseRow(FolderSchema, objectField(result, 'folder', where), where)
    const files = arrayField(result, 'files', where).map((row, i) =>
      parseRow(VocabFileSchema, row, `${where}: files ${i}`),
    )
    const terms = arrayField(result, 'terms', where).map((row, i) =>
      parseRow(TermBoxSchema, row, `${where}: terms ${i}`),
    )
    return { folder, files: summarizeFiles(files, terms) }
  }

  async createFolder(input: FolderInput): Promise<Folder> {
    const { name } = parseOrThrow(FolderInputSchema, input)
    const now = this.timestamp()
    const folder: Folder = { id: this.deps.newId(), name, createdAt: now, updatedAt: now }
    const row = await this.run(
      this.client.from('folders').insert(folderToRow(folder)).select().single(),
      (constraint) => this.folderConstraintError(constraint, name, folder.id),
    )
    return parseRow(FolderSchema, row, `folders ${folder.id}`)
  }

  async renameFolder(id: string, input: FolderInput): Promise<Folder> {
    const { name } = parseOrThrow(FolderInputSchema, input)
    if (!isId(id)) throw new EntityNotFoundError('folder', id)
    const rows = await this.run(
      this.client
        .from('folders')
        .update({ ...nameColumns(name), updated_at: this.timestamp() })
        .eq('id', id)
        .select(),
      (constraint) => this.folderConstraintError(constraint, name, id),
    )
    const [row] = asArray(rows)
    if (row === undefined) throw new EntityNotFoundError('folder', id)
    return parseRow(FolderSchema, row, `folders ${id}`)
  }

  async deleteFolder(id: string): Promise<void> {
    if (!isId(id)) return
    // Files, terms and progress go with it: foreign keys cascade.
    await this.run(this.client.from('folders').delete().eq('id', id))
  }

  // ---- Files ----

  async listFiles(folderId: string): Promise<VocabFile[]> {
    if (!isId(folderId)) return []
    const rows = await this.run(this.client.from('files').select('*').eq('folder_id', folderId))
    return limited(rows, 'files')
      .map((row, i) => parseRow(VocabFileSchema, row, `files ${i}`))
      .toSorted(byName)
  }

  async getFile(id: string): Promise<VocabFile | undefined> {
    if (!isId(id)) return undefined
    const row = await this.run(this.client.from('files').select('*').eq('id', id).maybeSingle())
    return row === null ? undefined : parseRow(VocabFileSchema, row, `files ${id}`)
  }

  async createFile(folderId: string, input: FileInput): Promise<VocabFile> {
    const { name } = parseOrThrow(FileInputSchema, input)
    if (!isId(folderId)) throw new EntityNotFoundError('folder', folderId)
    const now = this.timestamp()
    const file: VocabFile = {
      id: this.deps.newId(),
      folderId,
      name,
      createdAt: now,
      updatedAt: now,
    }
    const row = await this.run(
      this.client.from('files').insert(fileToRow(file)).select().single(),
      (constraint) => this.fileConstraintError(constraint, name, file.id, folderId),
    )
    return parseRow(VocabFileSchema, row, `files ${file.id}`)
  }

  async renameFile(id: string, input: FileInput): Promise<VocabFile> {
    const { name } = parseOrThrow(FileInputSchema, input)
    if (!isId(id)) throw new EntityNotFoundError('file', id)
    const rows = await this.run(
      this.client
        .from('files')
        .update({ ...nameColumns(name), updated_at: this.timestamp() })
        .eq('id', id)
        .select(),
      (constraint) => this.fileConstraintError(constraint, name, id),
    )
    const [row] = asArray(rows)
    if (row === undefined) throw new EntityNotFoundError('file', id)
    return parseRow(VocabFileSchema, row, `files ${id}`)
  }

  async deleteFile(id: string): Promise<void> {
    if (!isId(id)) return
    await this.run(this.client.from('files').delete().eq('id', id))
  }

  // ---- Terms ----

  async listTerms(fileId: string): Promise<Term[]> {
    if (!isId(fileId)) return []
    // An RPC, not a select: a file may hold more than MAX_ROWS terms.
    const rows = await this.run(this.client.rpc('list_terms', { p_file_id: fileId }))
    return asArray(rows)
      .map((row, i) => parseRow(TermSchema, row, `terms ${i}`))
      .toSorted(newestFirst)
  }

  async createTerm(fileId: string, input: TermInput): Promise<Term> {
    const content = parseOrThrow(TermInputSchema, input)
    if (!isId(fileId)) throw new EntityNotFoundError('file', fileId)
    const now = this.timestamp()
    const term: Term = { id: this.deps.newId(), fileId, ...content, createdAt: now, updatedAt: now }
    const row = await this.run(
      this.client.from('terms').insert(termToRow(term)).select().single(),
      (constraint) =>
        constraint === 'terms_file_fkey' ? new EntityNotFoundError('file', fileId) : undefined,
    )
    return parseRow(TermSchema, row, `terms ${term.id}`)
  }

  async updateTerm(id: string, input: TermInput): Promise<Term> {
    const content = parseOrThrow(TermInputSchema, input)
    if (!isId(id)) throw new EntityNotFoundError('term', id)
    // Every content column, null for a removed field (#34); the progress row is untouched.
    const rows = await this.run(
      this.client
        .from('terms')
        .update({ ...termContentToRow(content), updated_at: this.timestamp() })
        .eq('id', id)
        .select(),
    )
    // Also when its file was deleted elsewhere: the cascade already removed the term.
    const [row] = asArray(rows)
    if (row === undefined) throw new EntityNotFoundError('term', id)
    return parseRow(TermSchema, row, `terms ${id}`)
  }

  async deleteTerm(id: string): Promise<void> {
    if (!isId(id)) return
    await this.run(this.client.from('terms').delete().eq('id', id))
  }

  async findTermsByWord(word: string, excludeTermId?: string): Promise<TermLocation[]> {
    const wordKey = toKey(word)
    if (!wordKey) return []
    // One request with embedded parents, so names and terms come from one snapshot.
    let query = this.client
      .from('terms')
      .select('id, file_id, files(name, folders(name))')
      .eq('word_key', wordKey)
    if (excludeTermId !== undefined && isId(excludeTermId)) query = query.neq('id', excludeTermId)
    const rows = await this.run(query)
    return limited(rows, 'matching terms')
      .map((row, i): TermLocation => {
        const where = `matching terms ${i}`
        const term = parseRow(TermSchema.pick({ id: true, fileId: true }), row, where)
        const fileRow = objectField(row, 'files', where)
        const file = parseRow(VocabFileSchema.pick({ name: true }), fileRow, `${where}: file`)
        const folderRow = objectField(fileRow, 'folders', where)
        const folder = parseRow(FolderSchema.pick({ name: true }), folderRow, `${where}: folder`)
        return {
          termId: term.id,
          fileId: term.fileId,
          folderName: folder.name,
          fileName: file.name,
        }
      })
      .toSorted(byLocation)
  }

  // ---- Backup ----

  async exportBackup(): Promise<Backup> {
    const exportedAt = this.timestamp()
    const result = await this.run(this.client.rpc('export_backup'))
    // Converted but not validated, as the Repository contract requires: a safety copy must
    // still download when some stored row is off; importing it validates.
    const rows = <S extends Parameters<typeof convertRow>[0]>(schema: S, key: string) =>
      arrayField(result, key, 'backup').map((row, i) => convertRow(schema, row, `${key} ${i}`))
    return {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt,
      folders: rows(FolderSchema, 'folders'),
      files: rows(VocabFileSchema, 'files'),
      terms: rows(TermSchema, 'terms'),
      progress: rows(TermProgressSchema, 'progress'),
      studyDays: rows(StudyDaySchema, 'study_days'),
    }
  }

  // ---- Helpers ----

  private timestamp(): string {
    return this.deps.now().toISOString()
  }

  /** Awaits a request and translates its error; see runRequest. */
  private run(request: PromiseLike<SupabaseResponse>, onConstraint?: ConstraintHandler) {
    return runRequest(request, { onConstraint })
  }

  private async folderConstraintError(constraint: string, name: string, selfId: string) {
    if (constraint !== 'folders_name_key_unique') return undefined
    const existing = await this.run(
      this.client
        .from('folders')
        .select('name')
        .eq('name_key', toKey(name))
        .neq('id', selfId)
        .maybeSingle(),
    )
    return new DuplicateNameError('folder', existingName(existing, name))
  }

  /** `folderId` is unknown when renaming: the name clash is then looked up via the file. */
  private async fileConstraintError(
    constraint: string,
    name: string,
    selfId: string,
    folderId?: string,
  ) {
    if (constraint === 'files_folder_fkey' && folderId !== undefined) {
      return new EntityNotFoundError('folder', folderId)
    }
    if (constraint !== 'files_name_key_unique') return undefined
    const parent =
      folderId ??
      (await this.run(
        this.client.from('files').select('folder_id').eq('id', selfId).maybeSingle(),
      ).then((row) => (row as { folder_id?: string } | null)?.folder_id))
    const existing =
      parent === undefined
        ? null
        : await this.run(
            this.client
              .from('files')
              .select('name')
              .eq('folder_id', parent)
              .eq('name_key', toKey(name))
              .neq('id', selfId)
              .maybeSingle(),
          )
    return new DuplicateNameError('file', existingName(existing, name))
  }
}

/** Postgres rejects a malformed uuid with an error; locally such an id simply matches nothing. */
function isId(id: string): boolean {
  return IdSchema.safeParse(id).success
}

function asArray(data: unknown): unknown[] {
  if (!Array.isArray(data)) throw new Error('Cloud response is not a list')
  return data
}

function limited(data: unknown, what: string): unknown[] {
  const rows = asArray(data)
  if (rows.length >= MAX_ROWS) {
    throw new Error(`Too many ${what} to load at once (the limit is ${MAX_ROWS - 1}).`)
  }
  return rows
}

/** The clashing row may have been renamed or deleted since; the typed name is then close enough. */
function existingName(row: unknown, fallback: string): string {
  const name = (row as { name?: unknown } | null)?.name
  return typeof name === 'string' ? name : fallback
}
