import { describe, expect, it } from 'vitest'
import { compareNames, normalizeText, toKey } from './text.ts'

const NFD_TIENG = 'tiếng' // "tiếng" typed as base letters + combining marks
const NFC_TIENG = 'tiếng'

describe('normalizeText', () => {
  it('converts NFD to NFC', () => {
    expect(NFD_TIENG).not.toBe(NFC_TIENG)
    expect(normalizeText(NFD_TIENG)).toBe(NFC_TIENG)
  })

  it('trims and collapses whitespace, including tabs and newlines', () => {
    expect(normalizeText('  take \t off\n now  ')).toBe('take off now')
  })

  it('keeps letter case and curly quotes', () => {
    expect(normalizeText('IELTS don’t')).toBe('IELTS don’t')
  })
})

describe('toKey', () => {
  it('ignores case, whitespace and Unicode form', () => {
    expect(toKey(`  Tiếng   ANH `)).toBe(toKey(`${NFD_TIENG} anh`))
  })

  it('treats curly and straight quotes as equal', () => {
    expect(toKey('don’t')).toBe("don't")
    expect(toKey('“quote”')).toBe('"quote"')
  })

  it('keeps diacritics', () => {
    expect(toKey('ma')).not.toBe(toKey('má'))
  })
})

describe('compareNames', () => {
  it('sorts numbers naturally and ignores case', () => {
    expect(['Unit 10', 'unit 2', 'Unit 1'].toSorted(compareNames)).toEqual([
      'Unit 1',
      'unit 2',
      'Unit 10',
    ])
  })

  it('orders Vietnamese letters the same on every device', () => {
    expect(['e', 'đi', 'dê', 'Đà'].toSorted(compareNames)).toEqual(['dê', 'Đà', 'đi', 'e'])
  })
})
