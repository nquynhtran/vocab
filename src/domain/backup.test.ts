import { describe, expect, it } from 'vitest'
import { validateBackup, type Backup } from './backup.ts'
import { ValidationError } from './errors.ts'

const NOW = '2026-10-22T08:00:00.000Z'
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function validBackup(): Backup {
  return {
    schemaVersion: 1,
    exportedAt: NOW,
    folders: [{ id: id(1), name: 'IELTS', createdAt: NOW, updatedAt: NOW }],
    files: [{ id: id(2), folderId: id(1), name: 'Unit 1', createdAt: NOW, updatedAt: NOW }],
    terms: [
      {
        id: id(3),
        fileId: id(2),
        word: 'run',
        partOfSpeech: 'verb',
        meaning: 'chạy',
        example: 'I run.',
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    progress: [{ termId: id(3), box: 2, correctCount: 1, wrongCount: 0, lastStudiedAt: NOW }],
    studyDays: [{ date: '2026-10-22', answeredCount: 12 }],
  }
}

function problemsOf(value: unknown): Readonly<Record<string, readonly string[]>> {
  try {
    validateBackup(value)
  } catch (error) {
    if (error instanceof ValidationError) return error.fieldErrors
    throw error
  }
  return expect.unreachable('backup was accepted')
}

describe('validateBackup', () => {
  it('accepts a valid backup unchanged', () => {
    const backup = validBackup()
    expect(validateBackup(backup)).toStrictEqual(backup)
  })

  it('accepts an empty backup', () => {
    const empty = {
      ...validBackup(),
      folders: [],
      files: [],
      terms: [],
      progress: [],
      studyDays: [],
    }
    expect(validateBackup(empty)).toStrictEqual(empty)
  })

  it('asks to reload for a backup from a newer version', () => {
    expect(problemsOf({ ...validBackup(), schemaVersion: 2 })).toEqual({
      schemaVersion: ['This backup is from a newer version. Reload the page to update the app.'],
    })
  })

  it.each([null, 'text', {}, { ...validBackup(), schemaVersion: 0 }])(
    'rejects something that is not a backup: %j',
    (value) => {
      expect(() => validateBackup(value)).toThrow(ValidationError)
    },
  )

  it.each([
    ['untrimmed text', (b: Backup) => ({ ...b, folders: [{ ...b.folders[0]!, name: ' IELTS ' }] })],
    [
      'NFD text',
      (b: Backup) => ({ ...b, terms: [{ ...b.terms[0]!, meaning: 'chạy'.normalize('NFD') }] }),
    ],
    ['a blank example', (b: Backup) => ({ ...b, terms: [{ ...b.terms[0]!, example: '  ' }] })],
    [
      'an empty part of speech',
      (b: Backup) => ({ ...b, terms: [{ ...b.terms[0]!, partOfSpeech: '' }] }),
    ],
    ['an unknown field', (b: Backup) => ({ ...b, files: [{ ...b.files[0]!, nameKey: 'unit 1' }] })],
  ])('rejects data the schemas would change: %s', (_, change) => {
    expect(Object.keys(problemsOf(change(validBackup())))).toHaveLength(1)
  })

  it('names the path of the changed value', () => {
    const backup = validBackup()
    expect(problemsOf({ ...backup, terms: [{ ...backup.terms[0]!, word: 'run ' }] })).toEqual({
      'terms.0.word': ['Unexpected or non-normalized value'],
    })
  })

  it('treats an undefined optional field like an absent one', () => {
    const backup = validBackup()
    const term = { ...backup.terms[0]!, example: undefined, partOfSpeech: undefined }
    expect(validateBackup({ ...backup, terms: [term] }).terms).toHaveLength(1)
  })

  it('rejects an invalid record inside a table', () => {
    const backup = validBackup()
    const terms = [{ ...backup.terms[0], partOfSpeech: 'Verb' }]
    expect(problemsOf({ ...backup, terms })).toHaveProperty(['terms.0.partOfSpeech'])
  })

  it.each([
    [
      'folders',
      (b: Backup) => ({ ...b, folders: [...b.folders, { ...b.folders[0]!, name: 'B' }] }),
    ],
    ['files', (b: Backup) => ({ ...b, files: [...b.files, { ...b.files[0]!, name: 'B' }] })],
    ['terms', (b: Backup) => ({ ...b, terms: [...b.terms, b.terms[0]!] })],
    ['progress', (b: Backup) => ({ ...b, progress: [...b.progress, b.progress[0]!] })],
    ['studyDays', (b: Backup) => ({ ...b, studyDays: [...b.studyDays, b.studyDays[0]!] })],
  ])('rejects a duplicate key in %s', (table, duplicate) => {
    expect(Object.keys(problemsOf(duplicate(validBackup())))).toEqual([`${table}.1`])
  })

  it('rejects folder names that differ only by case or spacing', () => {
    const backup = validBackup()
    const twin = { ...backup.folders[0]!, id: id(9), name: 'ielts' }
    expect(problemsOf({ ...backup, folders: [...backup.folders, twin] })).toEqual({
      'folders.1': ['A folder named "ielts" appears twice'],
    })
  })

  it('rejects twin file names in one folder but allows them in different folders', () => {
    const backup = validBackup()
    const otherFolder = { ...backup.folders[0]!, id: id(8), name: 'TOEIC' }
    const sameName = { ...backup.files[0]!, id: id(9), name: 'UNIT 1' }
    expect(problemsOf({ ...backup, files: [...backup.files, sameName] })).toEqual({
      'files.1': ['A file named "UNIT 1" appears twice in one folder'],
    })
    const elsewhere = { ...backup, folders: [...backup.folders, otherFolder] }
    const moved = { ...sameName, folderId: otherFolder.id }
    expect(validateBackup({ ...elsewhere, files: [...backup.files, moved] }).files).toHaveLength(2)
  })

  it('rejects references to records that are not in the backup', () => {
    const backup = validBackup()
    expect(
      problemsOf({
        ...backup,
        files: [{ ...backup.files[0]!, folderId: id(90) }],
        terms: [{ ...backup.terms[0]!, fileId: id(91) }],
        progress: [{ ...backup.progress[0]!, termId: id(92) }],
      }),
    ).toEqual({
      'files.0': [`Unknown folder ${id(90)}`],
      'terms.0': [`Unknown file ${id(91)}`],
      'progress.0': [`Unknown term ${id(92)}`],
    })
  })
})
