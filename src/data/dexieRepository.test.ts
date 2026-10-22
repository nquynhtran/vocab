// @vitest-environment node
import Dexie from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { describe, expect, it, vi } from 'vitest'
import { FolderSchema, TermSchema, VocabFileSchema } from '../domain/schemas.ts'
import { toKey } from '../domain/text.ts'
import { DB_NAME, VocabDb, type VocabDbOptions } from './db.ts'
import { DexieRepository } from './dexieRepository.ts'
import type { RepositoryDeps } from './deps.ts'
import { describeRepositoryContract, testDeps } from './repositoryContract.ts'

/** A fresh in-memory IndexedDB per test. */
function setup(options: Pick<VocabDbOptions, 'onVersionChange'> = {}, deps = testDeps()) {
  const indexedDB = new IDBFactory()
  const db = new VocabDb({ indexedDB, IDBKeyRange, ...options })
  return { db, repo: new DexieRepository(db, deps), indexedDB }
}

async function seedTerm(repo: DexieRepository) {
  const folder = await repo.createFolder({ name: 'IELTS' })
  const file = await repo.createFile(folder.id, { name: 'Unit 1' })
  const term = await repo.createTerm(file.id, { word: 'run', meaning: 'chạy', example: 'I run.' })
  return { folder, file, term }
}

describeRepositoryContract(async (deps: RepositoryDeps) => {
  const { db, repo } = setup({}, deps)
  return {
    repo,
    addProgress: async (rows) => void (await db.progress.bulkAdd([...rows])),
    addStudyDays: async (rows) => void (await db.studyDays.bulkAdd([...rows])),
  }
})

// ---- Dexie only: rows the repository never writes, and the stored shape ----

describe('orphan rows', () => {
  // IndexedDB has no foreign keys, so the repository checks parents itself.
  it('throws EntityNotFoundError when renaming a file whose folder is gone', async () => {
    const { repo, db } = setup()
    const { folder, file } = await seedTerm(repo)
    await db.folders.delete(folder.id)
    await expect(repo.renameFile(file.id, { name: 'Unit 9' })).rejects.toMatchObject({
      kind: 'folder',
    })
  })

  it('throws EntityNotFoundError if the term row exists but its file is gone', async () => {
    const { repo, db } = setup()
    const { file, term } = await seedTerm(repo)
    await db.files.delete(file.id)
    await expect(repo.updateTerm(term.id, { word: 'run', meaning: 'x' })).rejects.toMatchObject({
      kind: 'file',
    })
  })
})

describe('stored data', () => {
  it('reads terms stored before partOfSpeech existed (decision #29: no migration)', async () => {
    const { repo, db } = setup()
    const { file } = await seedTerm(repo)
    const oldRow = {
      id: '00000000-0000-4000-8000-0000000000bb',
      fileId: file.id,
      word: 'swim',
      wordKey: 'swim',
      meaning: 'bơi',
      createdAt: '2026-10-22T07:00:00.000Z',
      updatedAt: '2026-10-22T07:00:00.000Z',
    }
    await db.terms.add(oldRow)
    const { wordKey: _, ...expected } = oldRow
    expect((await repo.listTerms(file.id)).find((t) => t.id === oldRow.id)).toStrictEqual(expected)
    expect(TermSchema.parse(expected)).toEqual(expected)
  })

  it('omits unset optional fields instead of storing undefined', async () => {
    const { repo, db } = setup()
    const { file, term } = await seedTerm(repo)
    const bare = await repo.createTerm(file.id, { word: 'jog', meaning: 'x', partOfSpeech: '' })
    await repo.updateTerm(term.id, { word: 'run', meaning: 'chạy', example: ' ' })
    for (const id of [bare.id, term.id]) {
      const row = await db.terms.get(id)
      expect(row).not.toHaveProperty('partOfSpeech')
      expect(row).not.toHaveProperty('example')
    }
  })

  // Schemas normalize while parsing, so "parses" alone would also accept unnormalized rows.
  // Parsing must be a no-op on what the repository stored, and keys must match `toKey`.
  it('is already normalized and valid, so reads need no re-validation', async () => {
    const { repo, db } = setup()
    const { term } = await seedTerm(repo)
    await repo.updateTerm(term.id, { word: ' Don’t  ', meaning: ' đi\nbộ ' })
    await repo.createTerm(term.fileId, { word: 'walk', meaning: 'đi bộ', partOfSpeech: 'verb' })

    for (const { nameKey, ...folder } of await db.folders.toArray()) {
      expect(FolderSchema.parse(folder)).toEqual(folder)
      expect(nameKey).toBe(toKey(folder.name))
    }
    for (const { nameKey, ...file } of await db.files.toArray()) {
      expect(VocabFileSchema.parse(file)).toEqual(file)
      expect(nameKey).toBe(toKey(file.name))
    }
    for (const { wordKey, ...stored } of await db.terms.toArray()) {
      expect(TermSchema.parse(stored)).toEqual(stored)
      expect(wordKey).toBe(toKey(stored.word))
    }
  })

  it('has unique indexes as the last line of defence against duplicate names', async () => {
    const { repo, db } = setup()
    const { folder, file } = await seedTerm(repo)
    const id = '00000000-0000-4000-8000-0000000000aa'
    await expect(
      db.folders.add({ ...folder, id, nameKey: toKey(folder.name) }),
    ).rejects.toMatchObject({ name: 'ConstraintError' })
    await expect(db.files.add({ ...file, id, nameKey: toKey(file.name) })).rejects.toMatchObject({
      name: 'ConstraintError',
    })
  })
})

/** Copied, not imported: this is what the released v1 code declared. */
const V1_STORES = {
  folders: 'id, &nameKey',
  files: 'id, folderId, &[folderId+nameKey]',
  terms: 'id, fileId, wordKey',
  progress: 'termId',
  studyDays: 'date',
  meta: 'key',
}

describe('version 2', () => {
  it('opens a v1 database without changing its data', async () => {
    const indexedDB = new IDBFactory()
    const v1 = new Dexie(DB_NAME, { indexedDB, IDBKeyRange })
    v1.version(1).stores(V1_STORES)
    const folder = { id: '00000000-0000-4000-8000-000000000001', name: 'IELTS', nameKey: 'ielts' }
    const term = {
      id: '00000000-0000-4000-8000-000000000003',
      fileId: '00000000-0000-4000-8000-000000000002',
      word: 'run',
      wordKey: 'run',
      meaning: 'chạy',
      createdAt: '2026-10-22T07:00:00.000Z',
      updatedAt: '2026-10-22T07:00:00.000Z',
    }
    await v1
      .table('folders')
      .add({ ...folder, createdAt: term.createdAt, updatedAt: term.createdAt })
    await v1.table('terms').add(term)
    v1.close()

    const db = new VocabDb({ indexedDB, IDBKeyRange })
    await db.open()

    expect(db.verno).toBe(2)
    expect(await db.folders.toArray()).toMatchObject([folder])
    expect(await db.terms.toArray()).toStrictEqual([term])
    db.close()
  })

  it('makes a tab still on v1 reload, so its old code cannot overwrite new fields', async () => {
    const indexedDB = new IDBFactory()
    const onOldTabVersionChange = vi.fn()
    const oldTab = new Dexie(DB_NAME, { indexedDB, IDBKeyRange })
    // The full v1 schema: a partial one would itself make Dexie bump the version.
    oldTab.version(1).stores(V1_STORES)
    oldTab.on('versionchange', () => {
      onOldTabVersionChange()
      oldTab.close({ disableAutoOpen: true })
      return false
    })
    await oldTab.open()

    const db = new VocabDb({ indexedDB, IDBKeyRange })
    await db.open()

    expect(onOldTabVersionChange).toHaveBeenCalledOnce()
    db.close()
  })
})

describe('schema upgrade from another tab', () => {
  it('closes this connection for good instead of reopening it with the old schema', async () => {
    const onVersionChange = vi.fn()
    const { repo, db, indexedDB } = setup({ onVersionChange })
    await repo.createFolder({ name: 'IELTS' })

    const newer = new Dexie(DB_NAME, { indexedDB, IDBKeyRange })
    newer.version(db.verno + 1).stores({
      folders: 'id, &nameKey',
      files: 'id, folderId, &[folderId+nameKey]',
      terms: 'id, fileId, wordKey',
      progress: 'termId',
      studyDays: 'date',
      meta: 'key',
      added: 'id',
    })
    await newer.open()

    expect(onVersionChange).toHaveBeenCalledOnce()
    await expect(repo.createFolder({ name: 'TOEIC' })).rejects.toMatchObject({
      name: 'DatabaseClosedError',
    })
    expect(await newer.table('folders').count()).toBe(1)
    newer.close()
  })
})
