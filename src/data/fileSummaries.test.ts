import { describe, expect, it } from 'vitest'
import { summarizeFiles } from './fileSummaries.ts'

const file = (n: number, name: string) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  folderId: '00000000-0000-4000-8000-000000000000',
  name,
  createdAt: '2026-10-22T08:00:00.000Z',
  updatedAt: '2026-10-22T08:00:00.000Z',
})

describe('summarizeFiles', () => {
  it('counts terms and mastered terms per file, sorted by name, empty files included', () => {
    const unit10 = file(1, 'Unit 10')
    const unit2 = file(2, 'Unit 2')
    const terms = [
      { fileId: unit10.id, box: 3 },
      { fileId: unit10.id, box: 2 },
      { fileId: unit10.id },
      { fileId: unit10.id, box: 5 },
    ]
    expect(summarizeFiles([unit10, unit2], terms)).toStrictEqual([
      { ...unit2, termCount: 0, masteredCount: 0 },
      { ...unit10, termCount: 4, masteredCount: 2 },
    ])
  })

  it('ignores terms of files that are not listed', () => {
    const unit1 = file(1, 'Unit 1')
    expect(summarizeFiles([unit1], [{ fileId: file(2, 'x').id, box: 5 }])).toStrictEqual([
      { ...unit1, termCount: 0, masteredCount: 0 },
    ])
  })
})
