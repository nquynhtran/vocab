import { describe, expect, it } from 'vitest'
import { validateBackup, type Backup } from '../domain/backup.ts'
import {
  DataAlreadyExistsError,
  DuplicateNameError,
  EntityNotFoundError,
  ValidationError,
} from '../domain/errors.ts'
import {
  FolderSchema,
  NOTES_MAX_LENGTH,
  PARTS_OF_SPEECH,
  StudyDaySchema,
  TermProgressSchema,
  TermSchema,
  VocabFileSchema,
  type StudyDay,
  type TermInput,
  type TermProgress,
} from '../domain/schemas.ts'
import type { AnswerRecord } from '../domain/learn/answer.ts'
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
  /** Writes progress and study days directly, so a test can start from any stored state. */
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

    it('edits notes alone, keeping line breaks, blank lines and indents', async () => {
      const { repo } = await setup()
      const folder = await repo.createFolder({ name: 'IELTS' })
      const file = await repo.createFile(folder.id, { name: 'Unit 1' })

      const edited = await repo.updateFileNotes(file.id, {
        notes: '\r\nReading:\r\n\r\n  The river runs.\n',
      })

      expect(edited).toStrictEqual({
        ...file,
        notes: 'Reading:\n\n  The river runs.',
        updatedAt: '2026-10-22T08:00:02.000Z',
      })
      expect(await repo.getFile(file.id)).toStrictEqual(edited)
      expect(await repo.listFiles(folder.id)).toStrictEqual([edited])
    })

    it('never lets a rename and a notes edit undo each other (#65)', async () => {
      const { repo } = await setup()
      const folder = await repo.createFolder({ name: 'IELTS' })
      const file = await repo.createFile(folder.id, { name: 'Unit 1' })
      await repo.updateFileNotes(file.id, { notes: 'Notes' })

      await repo.renameFile(file.id, { name: 'Unit 1a' })
      expect(await repo.getFile(file.id)).toMatchObject({ name: 'Unit 1a', notes: 'Notes' })

      await repo.updateFileNotes(file.id, { notes: 'New notes' })
      expect(await repo.getFile(file.id)).toMatchObject({ name: 'Unit 1a', notes: 'New notes' })
    })

    it('removes blank notes instead of storing them', async () => {
      const { repo } = await setup()
      const folder = await repo.createFolder({ name: 'IELTS' })
      const file = await repo.createFile(folder.id, { name: 'Unit 1' })
      await repo.updateFileNotes(file.id, { notes: 'Notes' })

      const cleared = await repo.updateFileNotes(file.id, { notes: ' \n\n ' })

      expect(cleared).not.toHaveProperty('notes')
      expect(await repo.getFile(file.id)).toStrictEqual(cleared)
    })

    it(`stores notes of ${NOTES_MAX_LENGTH} characters, Vietnamese and emoji included`, async () => {
      const { repo } = await setup()
      const folder = await repo.createFolder({ name: 'IELTS' })
      const file = await repo.createFile(folder.id, { name: 'Unit 1' })
      for (const notes of [
        'ệ'.repeat(NOTES_MAX_LENGTH),
        '😀'.repeat(NOTES_MAX_LENGTH / 2),
        `${'a'.repeat(NOTES_MAX_LENGTH - 2)}\n\n`.slice(0, NOTES_MAX_LENGTH - 2) + '\nb',
      ]) {
        await repo.updateFileNotes(file.id, { notes })
        expect((await repo.getFile(file.id))?.notes).toBe(notes)
      }
    })

    it('rejects notes over the limit without writing anything', async () => {
      const { repo } = await setup()
      const folder = await repo.createFolder({ name: 'IELTS' })
      const file = await repo.createFile(folder.id, { name: 'Unit 1' })
      await expect(
        repo.updateFileNotes(file.id, { notes: 'a'.repeat(NOTES_MAX_LENGTH + 1) }),
      ).rejects.toBeInstanceOf(ValidationError)
      expect(await repo.getFile(file.id)).toStrictEqual(file)
    })

    it('throws EntityNotFoundError for notes of a missing or deleted file, recreating nothing', async () => {
      const { repo } = await setup()
      const { folder, file } = await seedTerm(repo)
      await expect(repo.updateFileNotes(MISSING_ID, { notes: 'x' })).rejects.toMatchObject({
        constructor: EntityNotFoundError,
        kind: 'file',
      })
      await repo.deleteFolder(folder.id)
      await expect(repo.updateFileNotes(file.id, { notes: 'x' })).rejects.toBeInstanceOf(
        EntityNotFoundError,
      )
      expect((await repo.exportBackup()).files).toEqual([])
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

    it('stores a pronunciation as typed, and omits a blank one', async () => {
      const { repo } = await setup()
      const { file } = await seedTerm(repo)
      const withSlashes = await repo.createTerm(file.id, {
        word: 'schedule',
        pronunciation: ' /ˈʃedʒ.uːl/ ',
        meaning: 'lịch trình',
      })
      const bare = await repo.createTerm(file.id, {
        word: 'walk',
        pronunciation: 'wɔːk',
        meaning: 'đi bộ',
      })
      const blank = await repo.createTerm(file.id, {
        word: 'go',
        pronunciation: '  ',
        meaning: 'đi',
      })
      expect(withSlashes.pronunciation).toBe('/ˈʃedʒ.uːl/')
      expect(bare.pronunciation).toBe('wɔːk')
      expect(blank).not.toHaveProperty('pronunciation')
      expect(await repo.listTerms(file.id)).toEqual(
        expect.arrayContaining([withSlashes, bare, blank]),
      )
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
        pronunciation: '/rʌn/',
        example: 'I run.',
      })
      expect(term).toMatchObject({
        partOfSpeech: 'verb',
        pronunciation: '/rʌn/',
        example: 'I run.',
      })
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
      expect((await repo.getLearnData(file.id))?.terms).toHaveLength(MORE_THAN_MAX_ROWS)
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

  describe('getLearnData', () => {
    it('reads the file, its terms newest first, their progress and the rest of the folder', async () => {
      const { repo, addProgress } = await setup()
      const { folder, file, term } = await seedTerm(repo)
      const walk = await repo.createTerm(file.id, { word: 'walk', meaning: 'đi bộ' })
      const unit2 = await repo.createFile(folder.id, { name: 'Unit 2' })
      await repo.createTerm(unit2.id, { word: 'jump', meaning: 'nhảy' })
      await repo.createTerm(unit2.id, { word: 'swim', meaning: 'bơi' })
      const other = await seedTerm(repo, 'TOEIC')
      const studied = {
        termId: term.id,
        box: 3,
        correctCount: 2,
        wrongCount: 1,
        lastWrongAt: '2026-10-20T09:00:00.000Z',
        lastStudiedAt: '2026-10-21T09:00:00.000Z',
        lastPromotedDay: '2026-10-21',
      }
      await addProgress([
        studied,
        { termId: other.term.id, box: 5, correctCount: 4, wrongCount: 0 },
      ])

      const data = await repo.getLearnData(file.id)

      expect(data && { ...data, distractors: data.distractors.toSorted(byWord) }).toStrictEqual({
        file,
        terms: [walk, term],
        progress: [studied],
        distractors: [
          { word: 'jump', meaning: 'nhảy' },
          { word: 'swim', meaning: 'bơi' },
        ],
      })
    })

    it('gives a file alone in its folder no distractors, and a missing file undefined', async () => {
      const { repo } = await setup()
      const { file } = await seedTerm(repo)
      expect(await repo.getLearnData(file.id)).toMatchObject({ progress: [], distractors: [] })
      expect(await repo.getLearnData(MISSING_ID)).toBeUndefined()
    })
  })

  describe('recordAnswer', () => {
    const answer = (termId: string, overrides: Partial<AnswerRecord> = {}): AnswerRecord => ({
      termId,
      correct: true,
      promote: false,
      answeredAt: '2026-10-25T09:00:00.123Z',
      day: '2026-10-25',
      ...overrides,
    })

    async function stored(repo: Repository) {
      const { progress, studyDays } = await repo.exportBackup()
      return { progress, studyDays }
    }

    it('starts a never studied term in box 1 and counts the study day', async () => {
      const { repo } = await setup()
      const { term } = await seedTerm(repo)

      await repo.recordAnswer(answer(term.id, { promote: true }))

      expect(await stored(repo)).toStrictEqual({
        progress: [
          {
            termId: term.id,
            box: 2,
            correctCount: 1,
            wrongCount: 0,
            lastStudiedAt: '2026-10-25T09:00:00.123Z',
            lastPromotedDay: '2026-10-25',
          },
        ],
        studyDays: [{ date: '2026-10-25', answeredCount: 1 }],
      })
    })

    it('applies the answer to what is stored: a wrong answer resets the box', async () => {
      const { repo, addProgress, addStudyDays } = await setup()
      const { term } = await seedTerm(repo)
      const before = {
        termId: term.id,
        box: 4,
        correctCount: 6,
        wrongCount: 1,
        lastWrongAt: '2026-10-01T09:00:00.000Z',
        lastStudiedAt: '2026-10-24T09:00:00.000Z',
        lastPromotedDay: '2026-10-24',
      }
      await addProgress([before])
      await addStudyDays([{ date: '2026-10-25', answeredCount: 9 }])

      await repo.recordAnswer(answer(term.id, { correct: false }))

      expect(await stored(repo)).toStrictEqual({
        progress: [
          {
            ...before,
            box: 1,
            wrongCount: 2,
            lastWrongAt: '2026-10-25T09:00:00.123Z',
            lastStudiedAt: '2026-10-25T09:00:00.123Z',
          },
        ],
        studyDays: [{ date: '2026-10-25', answeredCount: 10 }],
      })
    })

    it('counts a correct answer without promote, keeping the box and the other fields', async () => {
      const { repo, addProgress } = await setup()
      const { term } = await seedTerm(repo)
      const before = {
        termId: term.id,
        box: 4,
        correctCount: 6,
        wrongCount: 1,
        lastWrongAt: '2026-10-01T09:00:00.000Z',
        lastStudiedAt: '2026-10-24T09:00:00.000Z',
        lastPromotedDay: '2026-10-24',
      }
      await addProgress([before])

      await repo.recordAnswer(answer(term.id))

      expect((await stored(repo)).progress).toStrictEqual([
        { ...before, correctCount: 7, lastStudiedAt: '2026-10-25T09:00:00.123Z' },
      ])
    })

    it('goes up at most one box a day, and at most to box 5 (#50)', async () => {
      const { repo, addProgress } = await setup()
      const { term } = await seedTerm(repo)
      await addProgress([{ termId: term.id, box: 3, correctCount: 0, wrongCount: 0 }])
      const promote = (answeredAt: string, day: string) =>
        repo.recordAnswer(answer(term.id, { promote: true, answeredAt, day }))

      await promote('2026-10-25T09:00:00.000Z', '2026-10-25')
      await promote('2026-10-25T09:01:00.000Z', '2026-10-25')
      expect((await stored(repo)).progress).toMatchObject([{ box: 4, correctCount: 2 }])

      await promote('2026-10-26T09:00:00.000Z', '2026-10-26')
      await promote('2026-10-27T09:00:00.000Z', '2026-10-27')
      expect((await stored(repo)).progress).toMatchObject([
        { box: 5, correctCount: 4, lastPromotedDay: '2026-10-27' },
      ])
    })

    it('changes nothing when the same answer is sent again (#51)', async () => {
      const { repo } = await setup()
      const { term } = await seedTerm(repo)
      await repo.recordAnswer(answer(term.id))
      const once = await stored(repo)

      await repo.recordAnswer(answer(term.id))

      expect(await stored(repo)).toStrictEqual(once)
    })

    it('counts an answer once when it is sent twice at the same time', async () => {
      const { repo, addProgress } = await setup()
      const { file, term } = await seedTerm(repo)
      const fresh = await repo.createTerm(file.id, { word: 'walk', meaning: 'đi bộ' })
      await addProgress([{ termId: term.id, box: 2, correctCount: 0, wrongCount: 0 }])

      // A stored row and a first answer: the second request waits on a row lock or on the
      // unique key, then finds the answer already recorded.
      await Promise.all([
        repo.recordAnswer(answer(term.id, { promote: true })),
        repo.recordAnswer(answer(term.id, { promote: true })),
        repo.recordAnswer(answer(fresh.id)),
        repo.recordAnswer(answer(fresh.id)),
      ])

      const { progress, studyDays } = await stored(repo)
      expect(progress.toSorted((a, b) => (a.termId < b.termId ? -1 : 1))).toMatchObject([
        { termId: term.id, box: 3, correctCount: 1 },
        { termId: fresh.id, box: 1, correctCount: 1 },
      ])
      expect(studyDays).toStrictEqual([{ date: '2026-10-25', answeredCount: 2 }])
    })

    it('adds study days up per day, across terms', async () => {
      const { repo } = await setup()
      const { file, term } = await seedTerm(repo)
      const walk = await repo.createTerm(file.id, { word: 'walk', meaning: 'đi bộ' })

      await repo.recordAnswer(answer(term.id))
      await repo.recordAnswer(answer(walk.id))
      await repo.recordAnswer(
        answer(term.id, { answeredAt: '2026-10-26T09:00:00.000Z', day: '2026-10-26' }),
      )

      expect((await stored(repo)).studyDays.toSorted(byDate)).toStrictEqual([
        { date: '2026-10-25', answeredCount: 2 },
        { date: '2026-10-26', answeredCount: 1 },
      ])
    })

    it('ignores a term that no longer exists, without counting the study day', async () => {
      const { repo } = await setup()
      const { term } = await seedTerm(repo)
      await repo.deleteTerm(term.id)

      await expect(repo.recordAnswer(answer(term.id))).resolves.toBeUndefined()
      await expect(repo.recordAnswer(answer(MISSING_ID))).resolves.toBeUndefined()

      expect(await stored(repo)).toStrictEqual({ progress: [], studyDays: [] })
    })

    it('rejects a wrong answer that promotes, and an invalid record, writing nothing', async () => {
      const { repo } = await setup()
      const { term } = await seedTerm(repo)

      await expect(
        repo.recordAnswer(answer(term.id, { correct: false, promote: true })),
      ).rejects.toThrow(ValidationError)
      await expect(repo.recordAnswer(answer(term.id, { day: '25/10/2026' }))).rejects.toThrow(
        ValidationError,
      )

      expect(await stored(repo)).toStrictEqual({ progress: [], studyDays: [] })
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
          lastPromotedDay: '2026-10-21',
        },
      ]
      const studyDay = { date: '2026-10-22', answeredCount: 10 }
      await addProgress(progress)
      await addStudyDays([studyDay])

      const backup = await repo.exportBackup()

      expect(backup).toStrictEqual({
        schemaVersion: 3,
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

  describe('importIntoEmpty', () => {
    /** Every table, optional fields both set and absent, timestamps with milliseconds. */
    function sampleBackup(): Backup {
      const at = '2026-10-01T07:30:00.250Z'
      return {
        schemaVersion: 3,
        exportedAt: '2026-10-20T00:00:00.000Z',
        folders: [{ id: testId(101), name: 'IELTS', createdAt: at, updatedAt: at }],
        files: [
          {
            id: testId(201),
            folderId: testId(101),
            name: 'Unit 1',
            notes: 'Reading:\n\n  The river runs.',
            createdAt: at,
            updatedAt: at,
          },
          { id: testId(202), folderId: testId(101), name: 'Unit 2', createdAt: at, updatedAt: at },
        ],
        terms: [
          {
            id: testId(301),
            fileId: testId(201),
            word: 'Run',
            partOfSpeech: PARTS_OF_SPEECH[0],
            pronunciation: '/rʌn/',
            meaning: 'chạy',
            example: 'I run.',
            createdAt: at,
            updatedAt: '2026-10-02T08:00:00.000Z',
          },
          {
            id: testId(302),
            fileId: testId(201),
            word: 'walk',
            meaning: 'đi bộ',
            createdAt: at,
            updatedAt: at,
          },
        ],
        progress: [
          {
            termId: testId(301),
            box: 3,
            correctCount: 4,
            wrongCount: 1,
            lastWrongAt: at,
            lastStudiedAt: at,
            lastPromotedDay: '2026-09-30',
          },
          { termId: testId(302), box: 1, correctCount: 0, wrongCount: 0 },
        ],
        studyDays: [{ date: '2026-10-01', answeredCount: 12 }],
      }
    }

    const withoutExportTime = (backup: Backup): Omit<Backup, 'exportedAt'> => {
      const { exportedAt: _exportedAt, ...rest } = backup
      return rest
    }

    // Repositories copy fields one by one; a new field missing from the sample would pass the
    // round trip below even when a repository drops it.
    it('uses a sample that sets every field of every table', () => {
      const backup = sampleBackup()
      const shapes = {
        folders: FolderSchema.shape,
        files: VocabFileSchema.shape,
        terms: TermSchema.shape,
        progress: TermProgressSchema.shape,
        studyDays: StudyDaySchema.shape,
      }
      for (const [table, shape] of Object.entries(shapes)) {
        const rows: readonly object[] = backup[table as keyof typeof shapes]
        const present = new Set(rows.flatMap((row) => Object.keys(row)))
        expect({ table, missing: Object.keys(shape).filter((key) => !present.has(key)) }).toEqual({
          table,
          missing: [],
        })
      }
    })

    it('stores the backup exactly, keeping ids and timestamps', async () => {
      const { repo } = await setup()
      const backup = sampleBackup()

      await repo.importIntoEmpty(backup)

      expect(withoutExportTime(await repo.exportBackup())).toStrictEqual(withoutExportTime(backup))
    })

    it('stores comparison keys, so imported names and words are still matched by toKey', async () => {
      const { repo } = await setup()
      await repo.importIntoEmpty(sampleBackup())

      await expect(repo.createFolder({ name: 'ielts' })).rejects.toThrow(DuplicateNameError)
      await expect(repo.createFile(testId(101), { name: 'UNIT 1' })).rejects.toThrow(
        DuplicateNameError,
      )
      expect(await repo.findTermsByWord('run')).toStrictEqual([
        { termId: testId(301), fileId: testId(201), folderName: 'IELTS', fileName: 'Unit 1' },
      ])
    })

    it('refuses when a folder is already stored, and changes nothing', async () => {
      const { repo } = await setup()
      const { folder } = await seedTerm(repo, 'Existing')
      const before = withoutExportTime(await repo.exportBackup())

      await expect(repo.importIntoEmpty(sampleBackup())).rejects.toThrow(DataAlreadyExistsError)

      expect(withoutExportTime(await repo.exportBackup())).toStrictEqual(before)
      expect(before.folders).toEqual([folder])
    })

    it('refuses a second import, so retrying never duplicates anything', async () => {
      const { repo } = await setup()
      await repo.importIntoEmpty(sampleBackup())

      await expect(repo.importIntoEmpty(sampleBackup())).rejects.toThrow(DataAlreadyExistsError)
    })

    it('refuses when only study days are stored', async () => {
      const { repo, addStudyDays } = await setup()
      await addStudyDays([{ date: '2026-09-30', answeredCount: 1 }])

      await expect(repo.importIntoEmpty(sampleBackup())).rejects.toThrow(DataAlreadyExistsError)
      expect((await repo.exportBackup()).folders).toEqual([])
    })

    it('rejects an invalid backup before writing anything', async () => {
      const { repo } = await setup()
      const backup = sampleBackup()
      const orphan = { ...backup.terms[0], id: testId(303), word: 'swim', fileId: MISSING_ID }
      // The cast stands in for an untrusted file: the type cannot express a dangling reference.
      const broken = { ...backup, terms: [...backup.terms, orphan] } as Backup

      await expect(repo.importIntoEmpty(broken)).rejects.toThrow(ValidationError)
      expect(withoutExportTime(await repo.exportBackup())).toMatchObject({ folders: [], terms: [] })
    })
  })
}

const byWord = (a: { word: string }, b: { word: string }) => (a.word < b.word ? -1 : 1)
const byDate = (a: StudyDay, b: StudyDay) => (a.date < b.date ? -1 : 1)
