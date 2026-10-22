import { describe, expect, it } from 'vitest'
import { deleteFileMessage, deleteFolderMessage, plural } from './deleteMessages.ts'

describe('plural', () => {
  it('uses the singular only for exactly one', () => {
    expect(plural(0, 'file')).toBe('0 files')
    expect(plural(1, 'file')).toBe('1 file')
    expect(plural(2, 'term')).toBe('2 terms')
  })
})

describe('delete messages', () => {
  it('says how much is inside', () => {
    expect(deleteFolderMessage('IELTS', 3, 120)).toBe(
      'Delete folder "IELTS" and its 3 files (120 terms)?',
    )
    expect(deleteFileMessage('Unit 1', 1)).toBe('Delete file "Unit 1" and its 1 term?')
  })

  it('stays short when empty', () => {
    expect(deleteFolderMessage('IELTS', 0, 0)).toBe('Delete folder "IELTS"?')
    expect(deleteFileMessage('Unit 1', 0)).toBe('Delete file "Unit 1"?')
  })
})
