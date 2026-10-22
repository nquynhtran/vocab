// @vitest-environment node
import Dexie from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { describe, expect, it, vi } from 'vitest'
import { DuplicateNameError, EntityNotFoundError, ValidationError } from '../domain/errors.ts'
import { FolderSchema, TermSchema, VocabFileSchema } from '../domain/schemas.ts'
import { toKey } from '../domain/text.ts'
import { DB_NAME, VocabDb, type VocabDbOptions } from './db.ts'
import { DexieRepository } from './dexieRepository.ts'

const MISSING_ID = '00000000-0000-4000-8000-ffffffffffff'

/** A fresh in-memory IndexedDB per test, with deterministic ids and a clock that ticks 1 s per call. */
function setup(options: Pick<VocabDbOptions, 'onVersionChange'> = {}) {
  const indexedDB = new IDBFactory()
  const db = new VocabDb({ indexedDB, IDBKeyRange, ...options })
  let seconds = 0
  let ids = 0
  const repo = new DexieRepository(db, {
    now: () => new Date(Date.UTC(2026, 9, 22, 8, 0, seconds++)),
    newId: () => `00000000-0000-4000-8000-${String(++ids).padStart(12, '0')}`,
  })
  return { db, repo, indexedDB }
}

async function seedTerm(repo: DexieRepository, folderName = 'IELTS') {
  const folder = await repo.createFolder({ name: folderName })
  const file = await repo.createFile(folder.id, { name: 'Unit 1' })
  const term = await repo.createTerm(file.id, { word: 'run', meaning: 'chạy', example: 'I run.' })
  return { folder, file, term }
}

describe('folders', () => {
  it('creates a folder with normalized name and no storage keys', async () => {
    const { repo } = setup()
    const folder = await repo.createFolder({ name: '  IELTS   Writing ' })
    expect(folder).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      name: 'IELTS Writing',
      createdAt: '2026-10-22T08:00:00.000Z',
      updatedAt: '2026-10-22T08:00:00.000Z',
    })
    expect(await repo.getFolder(folder.id)).toEqual(folder)
    expect(await repo.getFolder(MISSING_ID)).toBeUndefined()
  })

  it('lists folders in natural name order', async () => {
    const { repo } = setup()
    for (const name of ['Unit 10', 'unit 2', 'Unit 1']) await repo.createFolder({ name })
    expect((await repo.listFolders()).map((f) => f.name)).toEqual(['Unit 1', 'unit 2', 'Unit 10'])
  })

  it.each([
    ['different case', 'ielts'],
    ['extra whitespace', '  IELTS '],
    ['NFD vs NFC', 'Tiếng'],
  ])('rejects a duplicate name with %s', async (_, duplicate) => {
    const { repo } = setup()
    await repo.createFolder({ name: 'IELTS' })
    await repo.createFolder({ name: 'Tiếng' })
    await expect(repo.createFolder({ name: duplicate })).rejects.toBeInstanceOf(DuplicateNameError)
    expect(await repo.listFolders()).toHaveLength(2)
  })

  it('names the existing folder in the duplicate error', async () => {
    const { repo } = setup()
    await repo.createFolder({ name: 'IELTS' })
    await expect(repo.createFolder({ name: 'ielts' })).rejects.toThrow(
      'A folder named "IELTS" already exists.',
    )
  })

  it('rejects invalid input without writing anything', async () => {
    const { repo } = setup()
    await expect(repo.createFolder({ name: '   ' })).rejects.toBeInstanceOf(ValidationError)
    await expect(repo.createFolder({ name: 'x'.repeat(201) })).rejects.toBeInstanceOf(
      ValidationError,
    )
    expect(await repo.listFolders()).toEqual([])
  })

  it('renames, allowing a change of letter case only', async () => {
    const { repo } = setup()
    const folder = await repo.createFolder({ name: 'ielts' })
    const renamed = await repo.renameFolder(folder.id, { name: 'IELTS' })
    expect(renamed).toEqual({ ...folder, name: 'IELTS', updatedAt: '2026-10-22T08:00:01.000Z' })
    expect(await repo.listFolders()).toEqual([renamed])
  })

  it('rejects renaming to another folder name', async () => {
    const { repo } = setup()
    await repo.createFolder({ name: 'IELTS' })
    const toeic = await repo.createFolder({ name: 'TOEIC' })
    await expect(repo.renameFolder(toeic.id, { name: 'Ielts' })).rejects.toBeInstanceOf(
      DuplicateNameError,
    )
    expect(await repo.getFolder(toeic.id)).toEqual(toeic)
  })

  it('throws EntityNotFoundError when renaming a missing folder', async () => {
    const { repo } = setup()
    await expect(repo.renameFolder(MISSING_ID, { name: 'X' })).rejects.toBeInstanceOf(
      EntityNotFoundError,
    )
    expect(await repo.listFolders()).toEqual([])
  })

  it('deletes a folder with its files, terms and progress, leaving other folders alone', async () => {
    const { repo, db } = setup()
    const { folder, file, term } = await seedTerm(repo)
    await repo.createFile(folder.id, { name: 'Unit 2' })
    await db.progress.add({ termId: term.id, box: 2, correctCount: 1, wrongCount: 0 })
    const other = await seedTerm(repo, 'TOEIC')

    await repo.deleteFolder(folder.id)

    expect(await repo.listFolders()).toEqual([other.folder])
    expect(await repo.listFiles(folder.id)).toEqual([])
    expect(await repo.listTerms(file.id)).toEqual([])
    expect(await db.progress.get(term.id)).toBeUndefined()
    expect(await repo.listTerms(other.file.id)).toEqual([other.term])
  })

  it('treats deleting a missing folder as a no-op', async () => {
    const { repo } = setup()
    await expect(repo.deleteFolder(MISSING_ID)).resolves.toBeUndefined()
  })
})

describe('files', () => {
  it('allows the same file name in different folders but not in the same one', async () => {
    const { repo } = setup()
    const ielts = await repo.createFolder({ name: 'IELTS' })
    const toeic = await repo.createFolder({ name: 'TOEIC' })
    await repo.createFile(ielts.id, { name: 'Unit 1' })
    await repo.createFile(toeic.id, { name: 'Unit 1' })
    await expect(repo.createFile(ielts.id, { name: 'unit 1' })).rejects.toThrow(
      'A file named "Unit 1" already exists in this folder.',
    )
    expect(await repo.listFiles(ielts.id)).toHaveLength(1)
  })

  it('lists files of one folder in natural name order', async () => {
    const { repo } = setup()
    const folder = await repo.createFolder({ name: 'IELTS' })
    const other = await repo.createFolder({ name: 'TOEIC' })
    for (const name of ['Unit 10', 'Unit 2']) await repo.createFile(folder.id, { name })
    await repo.createFile(other.id, { name: 'Unit 1' })
    expect((await repo.listFiles(folder.id)).map((f) => f.name)).toEqual(['Unit 2', 'Unit 10'])
  })

  it('throws EntityNotFoundError when the folder does not exist, without creating the file', async () => {
    const { repo, db } = setup()
    await expect(repo.createFile(MISSING_ID, { name: 'Unit 1' })).rejects.toBeInstanceOf(
      EntityNotFoundError,
    )
    expect(await db.files.count()).toBe(0)
  })

  it('renames a file and rejects a name taken in the same folder', async () => {
    const { repo } = setup()
    const folder = await repo.createFolder({ name: 'IELTS' })
    const unit1 = await repo.createFile(folder.id, { name: 'Unit 1' })
    await repo.createFile(folder.id, { name: 'Unit 2' })
    expect((await repo.renameFile(unit1.id, { name: 'UNIT 1' })).name).toBe('UNIT 1')
    await expect(repo.renameFile(unit1.id, { name: 'unit 2' })).rejects.toBeInstanceOf(
      DuplicateNameError,
    )
    await expect(repo.renameFile(MISSING_ID, { name: 'X' })).rejects.toBeInstanceOf(
      EntityNotFoundError,
    )
    expect(await repo.getFile(unit1.id)).toMatchObject({ name: 'UNIT 1' })
  })

  it('throws EntityNotFoundError when renaming a file whose folder is gone', async () => {
    const { repo, db } = setup()
    const { folder, file } = await seedTerm(repo)
    await db.folders.delete(folder.id) // simulate an orphan; the repository never leaves one
    await expect(repo.renameFile(file.id, { name: 'Unit 9' })).rejects.toMatchObject({
      kind: 'folder',
    })
  })

  it('deletes a file with its terms and progress only', async () => {
    const { repo, db } = setup()
    const { folder, file, term } = await seedTerm(repo)
    const unit2 = await repo.createFile(folder.id, { name: 'Unit 2' })
    const kept = await repo.createTerm(unit2.id, { word: 'walk', meaning: 'đi bộ' })
    await db.progress.bulkAdd([
      { termId: term.id, box: 2, correctCount: 1, wrongCount: 0 },
      { termId: kept.id, box: 1, correctCount: 0, wrongCount: 1 },
    ])

    await repo.deleteFile(file.id)

    expect(await repo.getFile(file.id)).toBeUndefined()
    expect(await db.terms.get(term.id)).toBeUndefined()
    expect(await db.progress.get(term.id)).toBeUndefined()
    expect(await repo.listTerms(unit2.id)).toEqual([kept])
    expect(await db.progress.get(kept.id)).toBeDefined()
    await expect(repo.deleteFile(file.id)).resolves.toBeUndefined()
  })
})

describe('getFolderContents', () => {
  it('counts terms and mastered terms per file of one folder, including empty files', async () => {
    const { repo, db } = setup()
    const { folder, file, term } = await seedTerm(repo)
    const walk = await repo.createTerm(file.id, { word: 'walk', meaning: 'đi bộ' })
    await repo.createTerm(file.id, { word: 'jump', meaning: 'nhảy' }) // never studied
    const empty = await repo.createFile(folder.id, { name: 'Unit 10' })
    const unit2 = await repo.createFile(folder.id, { name: 'Unit 2' })
    const other = await seedTerm(repo, 'TOEIC')
    await db.progress.bulkAdd([
      { termId: term.id, box: 3, correctCount: 2, wrongCount: 0 },
      { termId: walk.id, box: 2, correctCount: 1, wrongCount: 0 },
      { termId: other.term.id, box: 5, correctCount: 4, wrongCount: 0 },
    ])

    expect(await repo.getFolderContents(folder.id)).toEqual({
      folder,
      files: [
        { ...file, termCount: 3, masteredCount: 1 },
        { ...unit2, termCount: 0, masteredCount: 0 },
        { ...empty, termCount: 0, masteredCount: 0 },
      ],
    })
  })

  it('returns undefined for a missing folder', async () => {
    const { repo } = setup()
    expect(await repo.getFolderContents(MISSING_ID)).toBeUndefined()
  })
})

describe('terms', () => {
  it('lists terms newest first, breaking timestamp ties by id', async () => {
    const { repo, db } = setup()
    const { file } = await seedTerm(repo)
    await repo.createTerm(file.id, { word: 'walk', meaning: 'đi bộ' })
    const createdAt = '2026-10-23T00:00:00.000Z'
    const base = { fileId: file.id, meaning: 'x', createdAt, updatedAt: createdAt }
    await db.terms.bulkAdd([
      { ...base, id: '00000000-0000-4000-8000-0000000000b2', word: 'b', wordKey: 'b' },
      { ...base, id: '00000000-0000-4000-8000-0000000000b1', word: 'a', wordKey: 'a' },
    ])
    expect((await repo.listTerms(file.id)).map((t) => t.word)).toEqual(['a', 'b', 'walk', 'run'])
  })

  it('stores a part of speech, and omits an empty one', async () => {
    const { repo, db } = setup()
    const { file } = await seedTerm(repo)
    const verb = await repo.createTerm(file.id, {
      word: 'walk',
      meaning: 'đi bộ',
      partOfSpeech: 'verb',
    })
    const unset = await repo.createTerm(file.id, {
      word: 'jog',
      meaning: 'chạy bộ',
      partOfSpeech: '',
    })
    expect(verb.partOfSpeech).toBe('verb')
    expect(await db.terms.get(verb.id)).toMatchObject({ partOfSpeech: 'verb' })
    expect(unset).not.toHaveProperty('partOfSpeech')
    expect(await db.terms.get(unset.id)).not.toHaveProperty('partOfSpeech')
  })

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

  it('omits a blank example instead of storing it', async () => {
    const { repo, db } = setup()
    const { file } = await seedTerm(repo)
    const term = await repo.createTerm(file.id, { word: 'walk', meaning: 'đi bộ', example: '  ' })
    expect(term).not.toHaveProperty('example')
    expect(await db.terms.get(term.id)).not.toHaveProperty('example')
  })

  it('throws EntityNotFoundError when the file does not exist, without creating the term', async () => {
    const { repo, db } = setup()
    await expect(
      repo.createTerm(MISSING_ID, { word: 'run', meaning: 'chạy' }),
    ).rejects.toBeInstanceOf(EntityNotFoundError)
    expect(await db.terms.count()).toBe(0)
  })

  it('updates content, keeps createdAt and progress, and can remove optional fields', async () => {
    const { repo, db } = setup()
    const { file, term: seeded } = await seedTerm(repo)
    const term = await repo.updateTerm(seeded.id, {
      word: 'run',
      meaning: 'chạy',
      partOfSpeech: 'verb',
      example: 'I run.',
    })
    const progress = { termId: term.id, box: 3, correctCount: 4, wrongCount: 1 }
    await db.progress.add(progress)

    const updated = await repo.updateTerm(term.id, { word: 'Run', meaning: 'chạy bộ' })

    expect(updated).toEqual({
      id: term.id,
      fileId: file.id,
      word: 'Run',
      meaning: 'chạy bộ',
      createdAt: term.createdAt,
      updatedAt: '2026-10-22T08:00:04.000Z',
    })
    expect(await db.terms.get(term.id)).toEqual({ ...updated, wordKey: 'run' })
    expect(await db.progress.get(term.id)).toEqual(progress)
  })

  it('does not recreate a term whose file was deleted in another tab', async () => {
    const { repo, db } = setup()
    const { file, term } = await seedTerm(repo)
    await repo.deleteFile(file.id)
    await expect(repo.updateTerm(term.id, { word: 'run', meaning: 'chạy' })).rejects.toBeInstanceOf(
      EntityNotFoundError,
    )
    expect(await db.terms.count()).toBe(0)
  })

  it('throws EntityNotFoundError if the term row exists but its file is gone', async () => {
    const { repo, db } = setup()
    const { file, term } = await seedTerm(repo)
    await db.files.delete(file.id) // simulate an orphan; the repository never leaves one
    await expect(repo.updateTerm(term.id, { word: 'run', meaning: 'x' })).rejects.toMatchObject({
      kind: 'file',
    })
  })

  it('deletes a term with its progress', async () => {
    const { repo, db } = setup()
    const { file, term } = await seedTerm(repo)
    await db.progress.add({ termId: term.id, box: 1, correctCount: 0, wrongCount: 0 })
    await repo.deleteTerm(term.id)
    expect(await repo.listTerms(file.id)).toEqual([])
    expect(await db.progress.count()).toBe(0)
    await expect(repo.deleteTerm(term.id)).resolves.toBeUndefined()
  })
})

describe('findTermsByWord', () => {
  it('finds the same word in other files, ignoring case and curly quotes', async () => {
    const { repo } = setup()
    const { folder, file, term } = await seedTerm(repo)
    const unit2 = await repo.createFile(folder.id, { name: 'Unit 2' })
    const dont = await repo.createTerm(unit2.id, { word: "don't", meaning: 'đừng' })
    await repo.createTerm(unit2.id, { word: 'running', meaning: 'đang chạy' })

    expect(await repo.findTermsByWord('  RUN ')).toEqual([
      { termId: term.id, fileId: file.id, folderName: 'IELTS', fileName: 'Unit 1' },
    ])
    expect(await repo.findTermsByWord('Don’t')).toEqual([
      { termId: dont.id, fileId: unit2.id, folderName: 'IELTS', fileName: 'Unit 2' },
    ])
  })

  it('also finds the same word in the same file (decision #25)', async () => {
    const { repo } = setup()
    const { file, term } = await seedTerm(repo)
    const second = await repo.createTerm(file.id, { word: 'Run', meaning: 'điều hành' })
    expect((await repo.findTermsByWord('run', second.id)).map((t) => t.termId)).toEqual([term.id])
  })

  it('excludes the term being edited and returns nothing for a blank word', async () => {
    const { repo } = setup()
    const { term } = await seedTerm(repo)
    expect(await repo.findTermsByWord('run', term.id)).toEqual([])
    expect(await repo.findTermsByWord('   ')).toEqual([])
  })
})

describe('stored data', () => {
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
