import { describe, expect, it } from 'vitest'
import { parseOrThrow, ValidationError } from './errors.ts'
import {
  FileNotesInputSchema,
  FolderInputSchema,
  NOTES_MAX_LENGTH,
  PRONUNCIATION_MAX_LENGTH,
  VocabFileSchema,
  StudyDaySchema,
  TermInputSchema,
  TermProgressSchema,
  TermSchema,
} from './schemas.ts'

const ID = '00000000-0000-4000-8000-000000000001'
const NOW = '2026-10-22T08:00:00.000Z'

describe('input schemas', () => {
  it('normalizes text before checking length', () => {
    expect(FolderInputSchema.parse({ name: `  IELTS \n Unit  1 ` })).toEqual({
      name: 'IELTS Unit 1',
    })
    expect(FolderInputSchema.safeParse({ name: ` ${'a'.repeat(200)}  ` }).success).toBe(true)
    expect(FolderInputSchema.safeParse({ name: 'a'.repeat(201) }).success).toBe(false)
  })

  it('rejects whitespace-only required fields', () => {
    expect(() => parseOrThrow(TermInputSchema, { word: ' ', meaning: '\t' })).toThrow(
      new ValidationError({
        word: ['Term is required'],
        meaning: ['Meaning is required'],
      }),
    )
  })

  it('reports errors per field', () => {
    try {
      parseOrThrow(TermInputSchema, { word: 'run', meaning: '', example: 'x'.repeat(501) })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).fieldErrors).toEqual({
        meaning: ['Meaning is required'],
        example: ['Example must be at most 500 characters'],
      })
    }
  })

  it('rejects characters the cloud cannot store, but accepts emoji', () => {
    for (const bad of ['a\u0000b', 'a\uD800b', 'a\uDC00']) {
      expect(() =>
        parseOrThrow(TermInputSchema, { word: bad, meaning: 'x', example: bad }),
      ).toThrow(
        new ValidationError({
          word: ['Term contains a character that cannot be saved'],
          example: ['Example contains a character that cannot be saved'],
        }),
      )
    }
    expect(FolderInputSchema.parse({ name: 'Fun 😀' })).toEqual({ name: 'Fun 😀' })
  })

  it('drops a blank example', () => {
    expect(TermInputSchema.parse({ word: 'run', meaning: 'chạy', example: '   ' })).toEqual({
      word: 'run',
      meaning: 'chạy',
      example: undefined,
    })
    expect(TermInputSchema.parse({ word: 'run', meaning: 'chạy' }).example).toBeUndefined()
  })
})

describe('part of speech', () => {
  it('accepts a listed value and treats the empty choice as not set', () => {
    const base = { word: 'run', meaning: 'chạy' }
    expect(TermInputSchema.parse({ ...base, partOfSpeech: 'phrasal verb' }).partOfSpeech).toBe(
      'phrasal verb',
    )
    expect(TermInputSchema.parse({ ...base, partOfSpeech: '' }).partOfSpeech).toBeUndefined()
    expect(TermInputSchema.parse(base).partOfSpeech).toBeUndefined()
  })

  it('rejects a value outside the list, e.g. from a tampered backup', () => {
    expect(() =>
      parseOrThrow(TermInputSchema, { word: 'run', meaning: 'chạy', partOfSpeech: 'Verb' }),
    ).toThrow(new ValidationError({ partOfSpeech: ['Choose a part of speech from the list'] }))
  })
})

describe('pronunciation', () => {
  const base = { word: 'run', meaning: 'chạy' }

  it('keeps what was typed, slashes included, after single-line normalization', () => {
    expect(TermInputSchema.parse({ ...base, pronunciation: ' /rʌn/ ' }).pronunciation).toBe('/rʌn/')
    expect(TermInputSchema.parse({ ...base, pronunciation: 'rʌn' }).pronunciation).toBe('rʌn')
  })

  it('treats a blank value as not set', () => {
    expect(TermInputSchema.parse({ ...base, pronunciation: '  ' }).pronunciation).toBeUndefined()
    expect(TermInputSchema.parse(base).pronunciation).toBeUndefined()
  })

  it(`allows at most ${PRONUNCIATION_MAX_LENGTH} characters`, () => {
    const atLimit = 'ə'.repeat(PRONUNCIATION_MAX_LENGTH)
    expect(TermInputSchema.parse({ ...base, pronunciation: atLimit }).pronunciation).toBe(atLimit)
    expect(() => parseOrThrow(TermInputSchema, { ...base, pronunciation: `${atLimit}ə` })).toThrow(
      new ValidationError({
        pronunciation: [`Pronunciation must be at most ${PRONUNCIATION_MAX_LENGTH} characters`],
      }),
    )
  })
})

describe('file notes', () => {
  it('keeps line breaks and blank lines', () => {
    const notes = 'Title\r\n\n  Paragraph one.\n\nParagraph two. '
    expect(FileNotesInputSchema.parse({ notes })).toEqual({
      notes: 'Title\n\n  Paragraph one.\n\nParagraph two.',
    })
  })

  it('treats blank notes as not set', () => {
    expect(FileNotesInputSchema.parse({ notes: ' \n\n ' }).notes).toBeUndefined()
  })

  it(`allows at most ${NOTES_MAX_LENGTH} characters, counted after normalization`, () => {
    const atLimit = 'a'.repeat(NOTES_MAX_LENGTH)
    expect(FileNotesInputSchema.parse({ notes: `\n${atLimit}\n` }).notes).toBe(atLimit)
    expect(() => parseOrThrow(FileNotesInputSchema, { notes: `${atLimit}a` })).toThrow(
      new ValidationError({ notes: [`Notes must be at most ${NOTES_MAX_LENGTH} characters`] }),
    )
  })

  it('rejects characters the cloud cannot store', () => {
    expect(() => parseOrThrow(FileNotesInputSchema, { notes: 'a\u0000b' })).toThrow(
      new ValidationError({ notes: ['Notes contains a character that cannot be saved'] }),
    )
  })

  it('is part of a stored file', () => {
    const file = {
      id: ID,
      folderId: ID,
      name: 'Unit 1',
      notes: 'Line 1\nLine 2',
      createdAt: NOW,
      updatedAt: NOW,
    }
    expect(VocabFileSchema.parse(file)).toStrictEqual(file)
  })
})

describe('entity schemas', () => {
  it('accepts a valid term', () => {
    const term = {
      id: ID,
      fileId: ID,
      word: 'run',
      meaning: 'chạy',
      createdAt: NOW,
      updatedAt: NOW,
    }
    expect(TermSchema.parse(term)).toEqual({ ...term, example: undefined })
  })

  it('rejects ids that are not RFC UUIDs', () => {
    const term = {
      id: 'abc',
      fileId: ID,
      word: 'run',
      meaning: 'x',
      createdAt: NOW,
      updatedAt: NOW,
    }
    expect(TermSchema.safeParse(term).success).toBe(false)
  })

  it('limits box to 1..5 and counts to non-negative integers', () => {
    const progress = { termId: ID, box: 1, correctCount: 0, wrongCount: 0 }
    expect(TermProgressSchema.safeParse(progress).success).toBe(true)
    expect(TermProgressSchema.safeParse({ ...progress, box: 0 }).success).toBe(false)
    expect(TermProgressSchema.safeParse({ ...progress, box: 6 }).success).toBe(false)
    expect(TermProgressSchema.safeParse({ ...progress, wrongCount: -1 }).success).toBe(false)
    expect(TermProgressSchema.safeParse({ ...progress, correctCount: 1.5 }).success).toBe(false)
  })

  it('accepts only real calendar dates for study days', () => {
    const valid = (date: string) => StudyDaySchema.safeParse({ date, answeredCount: 0 }).success
    expect(valid('2028-02-29')).toBe(true)
    expect(valid('2026-02-29')).toBe(false)
    expect(valid('2026-13-01')).toBe(false)
    expect(valid('2026-1-01')).toBe(false)
  })
})
