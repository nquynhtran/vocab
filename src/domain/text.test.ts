import { describe, expect, it } from 'vitest'
import { compareNames, normalizeMultilineText, normalizeText, toKey } from './text.ts'

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

describe('normalizeMultilineText', () => {
  it('turns every line break style into one newline', () => {
    expect(normalizeMultilineText('a\r\nb\rc\nd\u2028e\u2029f')).toBe('a\nb\nc\nd\ne\nf')
  })

  it('keeps blank lines, indents and inner spacing, trimming only the ends', () => {
    const reading = '  Title\n\n    First  paragraph.\n\n\n\tSecond.  \n '
    expect(normalizeMultilineText(reading)).toBe('Title\n\n    First  paragraph.\n\n\n\tSecond.')
  })

  it('converts NFD to NFC', () => {
    expect(normalizeMultilineText(`${NFD_TIENG}\n${NFD_TIENG}`)).toBe(`${NFC_TIENG}\n${NFC_TIENG}`)
  })

  it('returns an empty string for whitespace only', () => {
    expect(normalizeMultilineText(' \r\n\t\u2028 ')).toBe('')
  })

  // Imported backups and cloud rows are compared with their normalized form (decision #35).
  it.each([
    ['CR CR LF', 'a\r\r\nb'],
    ['CR LF LF', 'a\r\n\nb'],
    ['LF CR', 'a\n\rb'],
    ['NFD Vietnamese', `  ${NFD_TIENG}\r\n`],
    ['a leading combining mark', '\u0301a\r\n'],
    ['whitespace before a combining mark', ' \u0301 '],
    ['separators around text', '\u2028\r\n x \u2029'],
  ])('is idempotent: %s', (_, text) => {
    const once = normalizeMultilineText(text)
    expect(normalizeMultilineText(once)).toBe(once)
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
