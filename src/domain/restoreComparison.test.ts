import { describe, expect, it } from 'vitest'
import type { Backup } from './backup.ts'
import { compareForRestore } from './restoreComparison.ts'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const folder = (n: number, updatedAt: string) => ({
  id: id(n),
  name: `Folder ${n}`,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt,
})
const file = (n: number, updatedAt: string) => ({
  id: id(n),
  folderId: id(1),
  name: `File ${n}`,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt,
})
const term = (n: number, updatedAt: string) => ({
  id: id(n),
  fileId: id(10),
  word: `w${n}`,
  meaning: 'm',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt,
})
const days = (...dates: string[]) => dates.map((date) => ({ date, answeredCount: 10 }))

function backup(parts: Partial<Backup> = {}): Backup {
  return {
    schemaVersion: 3,
    exportedAt: '2026-11-08T00:00:00.000Z',
    folders: [],
    files: [],
    terms: [],
    progress: [],
    studyDays: [],
    ...parts,
  }
}

describe('compareForRestore', () => {
  it('counts each side and finds its latest edit and study day', () => {
    // The latest of each kind sits in the middle of its list, so neither first nor last wins.
    const current = backup({
      folders: [folder(1, '2026-10-01T00:00:00.000Z'), folder(2, '2026-10-03T00:00:00.000Z')],
      files: [
        file(10, '2026-10-02T00:00:00.000Z'),
        file(11, '2026-10-20T00:00:00.000Z'),
        file(12, '2026-10-04T00:00:00.000Z'),
      ],
      terms: [term(20, '2026-10-05T00:00:00.000Z')],
      studyDays: days('2026-10-01', '2026-10-09', '2026-10-02'),
    })

    expect(compareForRestore(current, backup()).current).toStrictEqual({
      folders: 2,
      files: 3,
      terms: 1,
      lastEdit: '2026-10-20T00:00:00.000Z',
      lastStudyDay: '2026-10-09',
    })
    expect(compareForRestore(backup(), current).backup).toStrictEqual(
      compareForRestore(current, backup()).current,
    )
  })

  it('takes the latest edit from terms too', () => {
    const current = backup({
      folders: [folder(1, '2026-10-01T00:00:00.000Z')],
      terms: [term(20, '2026-10-30T00:00:00.000Z'), term(21, '2026-10-02T00:00:00.000Z')],
    })
    expect(compareForRestore(current, backup()).current.lastEdit).toBe('2026-10-30T00:00:00.000Z')
  })

  it('compares timestamps as instants, whatever their decimals', () => {
    const current = backup({ folders: [folder(1, '2026-10-01T08:00:00.500Z')] })
    const file = backup({ folders: [folder(1, '2026-10-01T08:00:00Z')] })

    expect(compareForRestore(current, file).currentIsNewer).toBe(true)
    expect(compareForRestore(file, current).currentIsNewer).toBe(false)
    expect(
      compareForRestore(backup({ folders: [current.folders[0]!, file.folders[0]!] }), file),
    ).toMatchObject({ current: { lastEdit: '2026-10-01T08:00:00.500Z' } })
  })

  it('leaves the latest edit and study day out of an empty side', () => {
    expect(compareForRestore(backup(), backup()).current).toStrictEqual({
      folders: 0,
      files: 0,
      terms: 0,
      lastEdit: undefined,
      lastStudyDay: undefined,
    })
  })

  describe('currentIsNewer', () => {
    const older = backup({
      folders: [folder(1, '2026-10-01T00:00:00.000Z')],
      studyDays: days('2026-10-01'),
    })

    it('is true when current data was edited after the file', () => {
      const current = backup({ ...older, terms: [term(20, '2026-10-02T00:00:00.000Z')] })
      expect(compareForRestore(current, older).currentIsNewer).toBe(true)
    })

    it('is true when current data was studied after the file, with no newer edit', () => {
      const current = backup({ ...older, studyDays: days('2026-10-01', '2026-10-05') })
      expect(compareForRestore(current, older).currentIsNewer).toBe(true)
    })

    it('is false when the file is as new or newer on both counts', () => {
      expect(compareForRestore(older, older).currentIsNewer).toBe(false)
      const newer = backup({
        folders: [folder(1, '2026-10-03T00:00:00.000Z')],
        studyDays: days('2026-10-04'),
      })
      expect(compareForRestore(older, newer).currentIsNewer).toBe(false)
    })

    it('is true when the file holds no edit or study day at all', () => {
      expect(compareForRestore(older, backup()).currentIsNewer).toBe(true)
      expect(compareForRestore(backup(), older).currentIsNewer).toBe(false)
    })
  })

  describe('currentIsEmpty', () => {
    it('is true with no folder and no study day', () => {
      expect(compareForRestore(backup(), backup()).currentIsEmpty).toBe(true)
    })

    it('is false with only study days (left over from an old bug, #74)', () => {
      expect(
        compareForRestore(backup({ studyDays: days('2026-10-01') }), backup()).currentIsEmpty,
      ).toBe(false)
    })

    it('is false with only a folder', () => {
      const current = backup({ folders: [folder(1, '2026-10-01T00:00:00.000Z')] })
      expect(compareForRestore(current, backup()).currentIsEmpty).toBe(false)
    })
  })

  it('counts the study days that only current data has', () => {
    const current = backup({ studyDays: days('2026-10-01', '2026-10-02', '2026-10-03') })
    const file = backup({ studyDays: days('2026-10-02', '2026-09-30') })
    expect(compareForRestore(current, file).removedStudyDays).toBe(2)
  })
})
