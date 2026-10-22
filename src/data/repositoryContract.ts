import { describe, expect, it } from 'vitest'
import { validateBackup } from '../domain/backup.ts'
import { DuplicateNameError, EntityNotFoundError, ValidationError } from '../domain/errors.ts'
import {
  PARTS_OF_SPEECH,
  type StudyDay,
  type TermInput,
  type TermProgress,
} from '../domain/schemas.ts'
import type { RepositoryDeps } from './deps.ts'
import type { Repository } from './repository.ts'

/**
 * The behaviour every Repository must share (Liskov): errors, order, cascading deletes,
 * deleting something missing is a no-op. Run by dexieRepository.test.ts in CI and by
 * supabaseRepository.test.ts against local Supabase (`npm run test:supabase`).
 * Tests here only go through the repository; storage-specific checks stay in each test file.
 */
export interface ContractHarness {
  repo: Repository
  /** No repository method writes these yet (Learn comes later), so tests write them directly. */
  addProgress(rows: readonly TermProgress[]): Promise<void>
  addStudyDays(rows: readonly StudyDay[]): Promise<void>
}

/** Must return a repository over empty storage, using exactly the given deps. */
export type CreateHarness = (deps: RepositoryDeps) => Promise<ContractHarness>

export const MISSING_ID = '00000000-0000-4000-8000-ffffffffffff'

/** Above PostgREST's `max_rows`, which silently truncates a plain select (docs/cloud-sync.md). */
const MORE_THAN_MAX_ROWS = 1001

export function testId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

/** Deterministic ids and a clock that ticks 1 s per call, unless a test overrides them. */
export function testDeps(overrides: Partial<RepositoryDeps> = {}): RepositoryDeps {
  let seconds = 0
  let ids = 0
  return {
    now: () => new Date(Date.UTC(2026, 9, 22, 8, 0, seconds++)),
    newId: () => testId(++ids),
    ...overrides,
  }
}

export function describeRepositoryContract(createHarness: CreateHarness): void {
  const setup = (overrides: Partial<RepositoryDeps> = {}) => createHarness(testDeps(overrides))

  async function seedTerm(repo: Repository, folderName = 'IELTS') {
    const folder = await repo.createFolder({ name: folderName })
    const file = await repo.createFile(folder.id, { name: 'Unit 1' })
    const term = await repo.createTerm(file.id, { word: 'run', meaning: 'chạy', example: 'I run.' })
    return { folder, file, term }
  }

  /** Concurrent batches keep the cloud run fast; each create is still its own write. */
  async function createTerms(repo: Repository, fileId: string, count: number) {
    for (let start = 0; start < count; start += 100) {
      const batch = Array.from({ length: Math.min(100, count - start) }, (_, i) => start + i)
      await Promise.all(
        batch.map((n) => repo.createTerm(fileId, { word: `word ${n}`, meaning: 'nghĩa' })),
      )
    }
  }

  describe('folders', () => {
    it('creates a folder with normalized name and no storage keys', async () => {
      const { repo } = await setup()
      const folder = await repo.createFolder({ name: '  IELTS   Writing ' })
      expect(folder).toStrictEqual({
        id: testId(1),
        name: 'IELTS Writing',
        createdAt: '2026-10-22T08:00:00.000Z',
        updatedAt: '2026-10-22T08:00:00.000Z',
      })
      expect(await repo.getFolder(folder.id)).toStrictEqual(folder)
      expect(await repo.getFolder(MISSING_ID)).toBeUndefined()
    })

    it('lists folders in natural name order', async () => {
      const { repo } = await setup()
      for (const name of ['Unit 10', 'unit 2', 'Unit 1']) await repo.createFolder({ name })
      expect((await repo.listFolders()).map((f) => f.name)).toEqual(['Unit 1', 'unit 2', 'Unit 10'])
    })

    it.each([
      ['different case', 'ielts'],
      ['extra whitespace', '  IELTS '],
      ['NFD vs NFC', 'Tiếng'],
    ])('rejects a duplicate name with %s', async (_, duplicate) => {
      const { repo } = await setup()
      await repo.createFolder({ name: 'IELTS' })
      await repo.createFolder({ name: 'Tiếng' })
      await expect(repo.createFolder({ name: duplicate })).rejects.toBeInstanceOf(
        DuplicateNameError,
      )
      expect(await repo.listFolders()).toHaveLength(2)
    })

    it('names the existing folder in the duplicate error', async () => {
      const { repo } = await setup()
      await repo.createFolder({ name: 'IELTS' })
      await expect(repo.createFolder({ name: 'ielts' })).rejects.toThrow(
        'A folder named "IELTS" already exists.',
      )
    })

    it('rejects invalid input without writing anything', async () => {
      const { repo } = await setup()
      await expect(repo.createFolder({ name: '   ' })).rejects.toBeInstanceOf(ValidationError)
      await expect(repo.createFolder({ name: 'x'.repeat(201) })).rejects.toBeInstanceOf(
        ValidationError,
      )
      // Postgres cannot store these; the domain must reject them before any request.
      for (const name of ['a\u0000b', 'a\uD800b']) {
        await expect(repo.createFolder({ name })).rejects.toBeInstanceOf(ValidationError)
      }
      expect(await repo.listFolders()).toEqual([])
    })

    it('renames, allowing a change of letter case only', async () => {
      const { repo } = await setup()
      const folder = await repo.createFolder({ name: 'ielts' })
      const renamed = await repo.renameFolder(folder.id, { name: 'IELTS' })
      expect(renamed).toStrictEqual({
        ...folder,
        name: 'IELTS',
        updatedAt: '2026-10-22T08:00:01.000Z',
      })
      expect(await repo.listFolders()).toStrictEqual([renamed])
    })

    it('rejects renaming to another folder name', async () => {
      const { repo } = await setup()
      await repo.createFolder({ name: 'IELTS' })
      const toeic = await repo.createFolder({ name: 'TOEIC' })
      await expect(repo.renameFolder(toeic.id, { name: 'Ielts' })).rejects.toThrow(
        'A folder named "IELTS" already exists.',
      )
      expect(await repo.getFolder(toeic.id)).toStrictEqual(toeic)
    })

    it('throws EntityNotFoundError when renaming a missing folder', async () => {
      const { repo } = await setup()
      await expect(repo.renameFolder(MISSING_ID, { name: 'X' })).rejects.toMatchObject({
        constructor: EntityNotFoundError,
        kind: 'folder',
      })
      expect(await repo.listFolders()).toEqual([])
    })

    it('deletes a folder with its files, terms and progress, leaving other folders alone', async () => {
      const { repo, addProgress } = await setup()
      const { folder, file, term } = await seedTerm(repo)
      await repo.createFile(folder.id, { name: 'Unit 2' })
      const other = await seedTerm(repo, 'TOEIC')
      const kept = { termId: other.term.id, box: 1, correctCount: 0, wrongCount: 1 }
      await addProgress([{ termId: term.id, box: 2, correctCount: 1, wrongCount: 0 }, kept])

      await repo.deleteFolder(folder.id)

      expect(await repo.listFolders()).toStrictEqual([other.folder])
      expect(await repo.listFiles(folder.id)).toEqual([])
      expect(await repo.listTerms(file.id)).toEqual([])
      expect(await repo.listTerms(other.file.id)).toStrictEqual([other.term])
      expect(await repo.exportBackup()).toMatchObject({
        files: [other.file],
        terms: [other.term],
        progress: [kept],
      })
    })

    it('treats deleting a missing folder as a no-op', async () => {
      const { repo } = await setup()
      await expect(repo.deleteFolder(MISSING_ID)).resolves.toBeUndefined()
    })
  })

  describe('files', () => {
    it('creates a file and reads it back', async () => {
      const { repo } = await setup()
      const folder = await repo.createFolder({ name: 'IELTS' })
      const file = await repo.createFile(folder.id, { name: ' Unit  1 ' })
      expect(file).toStrictEqual({
        id: testId(2),
        folderId: folder.id,
        name: 'Unit 1',
        createdAt: '2026-10-22T08:00:01.000Z',
        updatedAt: '2026-10-22T08:00:01.000Z',
      })
      expect(await repo.getFile(file.id)).toStrictEqual(file)
      expect(await repo.getFile(MISSING_ID)).toBeUndefined()
    })

    it('allows the same file name in different folders but not in the same one', async () => {
      const { repo } = await setup()
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
      const { repo } = await setup()
      const folder = await repo.createFolder({ name: 'IELTS' })
      const other = await repo.createFolder({ name: 'TOEIC' })
      for (const name of ['Unit 10', 'Unit 2']) await repo.createFile(folder.id, { name })
      await repo.createFile(other.id, { name: 'Unit 1' })
      expect((await repo.listFiles(folder.id)).map((f) => f.name)).toEqual(['Unit 2', 'Unit 10'])
    })

    it('throws EntityNotFoundError when the folder does not exist, without creating the file', async () => {
      const { repo } = await setup()
      await expect(repo.createFile(MISSING_ID, { name: 'Unit 1' })).rejects.toMatchObject({
        constructor: EntityNotFoundError,
        kind: 'folder',
      })
      expect((await repo.exportBackup()).files).toEqual([])
    })

    it('renames a file and rejects a name taken in the same folder', async () => {
      const { repo } = await setup()
      const folder = await repo.createFolder({ name: 'IELTS' })
      const unit1 = await repo.createFile(folder.id, { name: 'Unit 1' })
      await repo.createFile(folder.id, { name: 'Unit 2' })
      expect(await repo.renameFile(unit1.id, { name: 'UNIT 1' })).toStrictEqual({
        ...unit1,
        name: 'UNIT 1',
        updatedAt: '2026-10-22T08:00:03.000Z',
      })
      await expect(repo.renameFile(unit1.id, { name: 'unit 2' })).rejects.toThrow(
        'A file named "Unit 2" already exists in this folder.',
      )
      await expect(repo.renameFile(MISSING_ID, { name: 'X' })).rejects.toMatchObject({
        constructor: EntityNotFoundError,
        kind: 'file',
      })
      expect(await repo.getFile(unit1.id)).toMatchObject({ name: 'UNIT 1' })
    })

    it('deletes a file with its terms and progress only', async () => {
      const { repo, addProgress } = await setup()
      const { folder, file, term } = await seedTerm(repo)
      const unit2 = await repo.createFile(folder.id, { name: 'Unit 2' })
      const kept = await repo.createTerm(unit2.id, { word: 'walk', meaning: 'đi bộ' })
      const keptProgress = { termId: kept.id, box: 1, correctCount: 0, wrongCount: 1 }
      await addProgress([{ termId: term.id, box: 2, correctCount: 1, wrongCount: 0 }, keptProgress])

      await repo.deleteFile(file.id)

      expect(await repo.getFile(file.id)).toBeUndefined()
      expect(await repo.listTerms(unit2.id)).toStrictEqual([kept])
      expect(await repo.exportBackup()).toMatchObject({
        terms: [kept],
        progress: [keptProgress],
      })
      await expect(repo.deleteFile(file.id)).resolves.toBeUndefined()
    })
  })

  describe('getFolderContents', () => {
    it('counts terms and mastered terms per file of one folder, including empty files', async () => {
      const { repo, addProgress } = await setup()
      const { folder, file, term } = await seedTerm(repo)
      const walk = await repo.createTerm(file.id, { word: 'walk', meaning: 'đi bộ' })
      await repo.createTerm(file.id, { word: 'jump', meaning: 'nhảy' }) // never studied
      const empty = await repo.createFile(folder.id, { name: 'Unit 10' })
      const unit2 = await repo.createFile(folder.id, { name: 'Unit 2' })
      const other = await seedTerm(repo, 'TOEIC')
      await addProgress([
        { termId: term.id, box: 3, correctCount: 2, wrongCount: 0 },
        { termId: walk.id, box: 2, correctCount: 1, wrongCount: 0 },
        { termId: other.term.id, box: 5, correctCount: 4, wrongCount: 0 },
      ])

      expect(await repo.getFolderContents(folder.id)).toStrictEqual({
        folder,
        files: [
          { ...file, termCount: 3, masteredCount: 1 },
          { ...unit2, termCount: 0, masteredCount: 0 },
          { ...empty, termCount: 0, masteredCount: 0 },
        ],
      })
    })

    it('returns undefined for a missing folder', async () => {
      const { repo } = await setup()
      expect(await repo.getFolderContents(MISSING_ID)).toBeUndefined()
    })
  })

  describe('terms', () => {
    it('lists terms newest first, breaking timestamp ties by id', async () => {
      const ids = [testId(1), testId(2), testId(0xb2), testId(0xb1)]
      const { repo } = await setup({
        now: () => new Date(Date.UTC(2026, 9, 22)),
        newId: () => ids.shift() ?? MISSING_ID,
      })
      const folder = await repo.createFolder({ name: 'IELTS' })
      const file = await repo.createFile(folder.id, { name: 'Unit 1' })
      await repo.createTerm(file.id, { word: 'b', meaning: 'x' })
      await repo.createTerm(file.id, { word: 'a', meaning: 'x' })
      expect((await repo.listTerms(file.id)).map((t) => t.word)).toEqual(['a', 'b'])
    })

    it('lists later terms first', async () => {
      const { repo } = await setup()
      const { file, term } = await seedTerm(repo)
      const walk = await repo.createTerm(file.id, { word: 'walk', meaning: 'đi bộ' })
      expect(await repo.listTerms(file.id)).toStrictEqual([walk, term])
    })

    it('stores every part of speech, and omits an empty one', async () => {
      const { repo } = await setup()
      const { file, term } = await seedTerm(repo)
      const created = []
      for (const partOfSpeech of PARTS_OF_SPEECH) {
        created.push(
          await repo.createTerm(file.id, { word: partOfSpeech, meaning: 'x', partOfSpeech }),
        )
      }
      const unset = await repo.createTerm(file.id, { word: 'jog', meaning: 'x', partOfSpeech: '' })

      expect(created.map((t) => t.partOfSpeech)).toEqual(PARTS_OF_SPEECH)
      expect(unset).not.toHaveProperty('partOfSpeech')
      expect(await repo.listTerms(file.id)).toStrictEqual([unset, ...created.toReversed(), term])
    })

    it('omits a blank example instead of storing it', async () => {
      const { repo } = await setup()
      const { file } = await seedTerm(repo)
      const term = await repo.createTerm(file.id, { word: 'walk', meaning: 'đi bộ', example: '  ' })
      expect(term).not.toHaveProperty('example')
      expect((await repo.listTerms(file.id))[0]).toStrictEqual(term)
    })

    it('rejects invalid input without writing anything', async () => {
      const { repo } = await setup()
      const { file } = await seedTerm(repo)
      const invalid: TermInput[] = [
        { word: ' ', meaning: 'x' },
        { word: 'x', meaning: 'x', example: 'e'.repeat(501) },
        { word: 'x', meaning: 'x', partOfSpeech: 'verbs' as TermInput['partOfSpeech'] },
      ]
      for (const input of invalid) {
        await expect(repo.createTerm(file.id, input)).rejects.toBeInstanceOf(ValidationError)
      }
      expect(await repo.listTerms(file.id)).toHaveLength(1)
    })

    it('throws EntityNotFoundError when the file does not exist, without creating the term', async () => {
      const { repo } = await setup()
      await expect(
        repo.createTerm(MISSING_ID, { word: 'run', meaning: 'chạy' }),
      ).rejects.toMatchObject({ constructor: EntityNotFoundError, kind: 'file' })
      expect((await repo.exportBackup()).terms).toEqual([])
    })

    it('updates content, keeps createdAt and progress, and can remove optional fields', async () => {
      const { repo, addProgress } = await setup()
      const { file, term: seeded } = await seedTerm(repo)
      const term = await repo.updateTerm(seeded.id, {
        word: 'run',
        meaning: 'chạy',
        partOfSpeech: 'verb',
        example: 'I run.',
      })
      expect(term).toMatchObject({ partOfSpeech: 'verb', example: 'I run.' })
      const progress = { termId: term.id, box: 3, correctCount: 4, wrongCount: 1 }
      await addProgress([progress])

      const updated = await repo.updateTerm(term.id, { word: 'Run', meaning: 'chạy bộ' })

      expect(updated).toStrictEqual({
        id: term.id,
        fileId: file.id,
        word: 'Run',
        meaning: 'chạy bộ',
        createdAt: term.createdAt,
        updatedAt: '2026-10-22T08:00:04.000Z',
      })
      expect(await repo.listTerms(file.id)).toStrictEqual([updated])
      expect((await repo.exportBackup()).progress).toStrictEqual([progress])
    })

    it('throws EntityNotFoundError when updating a missing term', async () => {
      const { repo } = await setup()
      await expect(
        repo.updateTerm(MISSING_ID, { word: 'run', meaning: 'chạy' }),
      ).rejects.toMatchObject({ constructor: EntityNotFoundError, kind: 'term' })
    })

    it('does not recreate a term whose file was deleted elsewhere', async () => {
      const { repo } = await setup()
      const { file, term } = await seedTerm(repo)
      await repo.deleteFile(file.id)
      await expect(
        repo.updateTerm(term.id, { word: 'run', meaning: 'chạy' }),
      ).rejects.toBeInstanceOf(EntityNotFoundError)
      expect((await repo.exportBackup()).terms).toEqual([])
    })

    it('deletes a term with its progress', async () => {
      const { repo, addProgress } = await setup()
      const { file, term } = await seedTerm(repo)
      await addProgress([{ termId: term.id, box: 1, correctCount: 0, wrongCount: 0 }])
      await repo.deleteTerm(term.id)
      expect(await repo.listTerms(file.id)).toEqual([])
      expect((await repo.exportBackup()).progress).toEqual([])
      await expect(repo.deleteTerm(term.id)).resolves.toBeUndefined()
    })

    it(`lists and counts more than ${MORE_THAN_MAX_ROWS - 1} terms without truncating`, async () => {
      const { repo } = await setup()
      const { folder, file } = await seedTerm(repo)
      await createTerms(repo, file.id, MORE_THAN_MAX_ROWS - 1)
      expect(await repo.listTerms(file.id)).toHaveLength(MORE_THAN_MAX_ROWS)
      expect((await repo.getFolderContents(folder.id))?.files).toMatchObject([
        { termCount: MORE_THAN_MAX_ROWS },
      ])
      expect((await repo.exportBackup()).terms).toHaveLength(MORE_THAN_MAX_ROWS)
    }, 60_000)
  })

  describe('findTermsByWord', () => {
    it('finds the same word in other files, ignoring case and curly quotes', async () => {
      const { repo } = await setup()
      const { folder, file, term } = await seedTerm(repo)
      const unit2 = await repo.createFile(folder.id, { name: 'Unit 2' })
      const dont = await repo.createTerm(unit2.id, { word: "don't", meaning: 'đừng' })
      await repo.createTerm(unit2.id, { word: 'running', meaning: 'đang chạy' })

      expect(await repo.findTermsByWord('  RUN ')).toStrictEqual([
        { termId: term.id, fileId: file.id, folderName: 'IELTS', fileName: 'Unit 1' },
      ])
      expect(await repo.findTermsByWord('Don’t')).toStrictEqual([
        { termId: dont.id, fileId: unit2.id, folderName: 'IELTS', fileName: 'Unit 2' },
      ])
    })

    it('sorts matches by folder name, then file name', async () => {
      const { repo } = await setup()
      await seedTerm(repo, 'TOEIC')
      const ielts = await seedTerm(repo, 'IELTS')
      const unit10 = await repo.createFile(ielts.folder.id, { name: 'Unit 10' })
      await repo.createTerm(unit10.id, { word: 'run', meaning: 'x' })
      expect((await repo.findTermsByWord('run')).map((t) => [t.folderName, t.fileName])).toEqual([
        ['IELTS', 'Unit 1'],
        ['IELTS', 'Unit 10'],
        ['TOEIC', 'Unit 1'],
      ])
    })

    it('breaks ties between matches in the same file by term id', async () => {
      // Ids decrease, so insertion order and id order disagree.
      const ids = [testId(1), testId(2), testId(0xc3), testId(0xc2), testId(0xc1)]
      const { repo } = await setup({ newId: () => ids.shift() ?? MISSING_ID })
      const folder = await repo.createFolder({ name: 'IELTS' })
      const file = await repo.createFile(folder.id, { name: 'Unit 1' })
      for (const meaning of ['chạy', 'điều hành', 'vận hành']) {
        await repo.createTerm(file.id, { word: 'run', meaning })
      }
      expect((await repo.findTermsByWord('run')).map((t) => t.termId)).toEqual([
        testId(0xc1),
        testId(0xc2),
        testId(0xc3),
      ])
    })

    it('also finds the same word in the same file (decision #25)', async () => {
      const { repo } = await setup()
      const { file, term } = await seedTerm(repo)
      const second = await repo.createTerm(file.id, { word: 'Run', meaning: 'điều hành' })
      expect((await repo.findTermsByWord('run', second.id)).map((t) => t.termId)).toEqual([term.id])
    })

    it('excludes the term being edited and returns nothing for a blank word', async () => {
      const { repo } = await setup()
      const { term } = await seedTerm(repo)
      expect(await repo.findTermsByWord('run', term.id)).toEqual([])
      expect(await repo.findTermsByWord('   ')).toEqual([])
    })
  })

  describe('exportBackup', () => {
    it('exports every table without storage keys, in a shape that passes import validation', async () => {
      const { repo, addProgress, addStudyDays } = await setup()
      const { folder, file, term } = await seedTerm(repo)
      const bare = await repo.createTerm(file.id, { word: 'walk', meaning: 'đi bộ' })
      const progress = [
        { termId: term.id, box: 2, correctCount: 1, wrongCount: 0 },
        {
          termId: bare.id,
          box: 1,
          correctCount: 0,
          wrongCount: 2,
          lastWrongAt: '2026-10-22T09:00:00.000Z',
          lastStudiedAt: '2026-10-22T09:00:01.500Z',
        },
      ]
      const studyDay = { date: '2026-10-22', answeredCount: 10 }
      await addProgress(progress)
      await addStudyDays([studyDay])

      const backup = await repo.exportBackup()

      expect(backup).toStrictEqual({
        schemaVersion: 1,
        exportedAt: '2026-10-22T08:00:04.000Z',
        folders: [folder],
        files: [file],
        terms: [term, bare],
        progress,
        studyDays: [studyDay],
      })
      expect(JSON.parse(JSON.stringify(validateBackup(backup)))).toStrictEqual(backup)
    })

    it('exports an empty database as an empty backup', async () => {
      const { repo } = await setup()
      expect(await repo.exportBackup()).toMatchObject({
        folders: [],
        files: [],
        terms: [],
        progress: [],
        studyDays: [],
      })
    })
  })
}
