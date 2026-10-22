import { describe, expect, it } from 'vitest'
import { InvalidStoredDataError } from '../domain/errors.ts'
import { FolderSchema, TermProgressSchema, TermSchema } from '../domain/schemas.ts'
import {
  convertRow,
  entityToRow,
  folderToRow,
  parseRow,
  termContentToRow,
  termToRow,
} from './supabaseRows.ts'

const ID = '00000000-0000-4000-8000-000000000001'
const FILE_ID = '00000000-0000-4000-8000-000000000002'
const USER_ID = 'c0000000-0000-4000-8000-000000000001'

/** A terms row as PostgREST returns it. */
const termRow = {
  id: ID,
  user_id: USER_ID,
  file_id: FILE_ID,
  word: "don't",
  word_key: "don't",
  part_of_speech: null,
  meaning: 'đừng',
  example: null,
  created_at: '2026-10-22T08:00:00+00:00',
  updated_at: '2026-10-22T08:00:01.5+00:00',
}

describe('parseRow', () => {
  it('maps snake_case to camelCase, drops storage columns and nulls, and normalizes time', () => {
    expect(parseRow(TermSchema, termRow, 'terms 0')).toStrictEqual({
      id: ID,
      fileId: FILE_ID,
      word: "don't",
      meaning: 'đừng',
      createdAt: '2026-10-22T08:00:00.000Z',
      updatedAt: '2026-10-22T08:00:01.500Z',
    })
  })

  it('keeps optional fields that are set', () => {
    const row = { ...termRow, part_of_speech: 'verb', example: 'Don’t go.' }
    expect(parseRow(TermSchema, row, 'terms 0')).toMatchObject({
      partOfSpeech: 'verb',
      example: 'Don’t go.',
    })
  })

  it('ignores columns the domain does not know yet, e.g. from a newer migration', () => {
    expect(parseRow(TermSchema, { ...termRow, added_later: 1 }, 'terms 0')).not.toHaveProperty(
      'addedLater',
    )
  })

  it('rejects a row the schema would change instead of fixing it (decision #35)', () => {
    expect(() => parseRow(TermSchema, { ...termRow, word: ' run ' }, 'terms 0')).toThrow(
      new InvalidStoredDataError('terms 0: word', 'value is not normalized'),
    )
    expect(() => parseRow(TermSchema, { ...termRow, example: '' }, 'terms 0')).toThrow(
      InvalidStoredDataError,
    )
  })

  it('rejects a stored key that does not match its text, e.g. after a hand edit', () => {
    expect(() => parseRow(TermSchema, { ...termRow, word: 'run' }, 'terms 0')).toThrow(
      new InvalidStoredDataError('terms 0: word_key', 'does not match word'),
    )
    const handRenamed = { ...termRow, name: 'TOEIC', name_key: 'ielts' }
    expect(() => parseRow(FolderSchema, handRenamed, 'folders 0')).toThrow(
      new InvalidStoredDataError('folders 0: name_key', 'does not match name'),
    )
  })

  it('checks keys only where the row carries them, as in an embedded select', () => {
    const { word_key: _, ...withoutKey } = termRow
    expect(parseRow(TermSchema, withoutKey, 'terms 0')).toMatchObject({ word: "don't" })
  })

  it('rejects invalid values with their location', () => {
    expect(() => parseRow(TermSchema, { ...termRow, part_of_speech: 'verbs' }, 'terms 0')).toThrow(
      /terms 0: partOfSpeech/,
    )
    expect(() => parseRow(TermSchema, { ...termRow, created_at: 'soon' }, 'terms 0')).toThrow(
      /terms 0: createdAt/,
    )
    expect(() => parseRow(TermSchema, { ...termRow, meaning: null }, 'terms 0')).toThrow(
      /terms 0: meaning/,
    )
    expect(() => parseRow(FolderSchema, 'IELTS', 'folders 0')).toThrow(
      new InvalidStoredDataError('folders 0', 'expected a row'),
    )
  })
})

describe('convertRow', () => {
  it('converts without validating, for exports that must not fail', () => {
    expect(convertRow(TermSchema, { ...termRow, word: ' run ' }, 'terms 0')).toMatchObject({
      word: ' run ',
      createdAt: '2026-10-22T08:00:00.000Z',
    })
  })

  it('leaves an unparseable timestamp as it is', () => {
    expect(convertRow(TermSchema, { ...termRow, created_at: 'soon' }, 'terms 0')).toMatchObject({
      createdAt: 'soon',
    })
  })
})

describe('writing', () => {
  const term = {
    id: ID,
    fileId: FILE_ID,
    word: 'Don’t',
    meaning: 'đừng',
    createdAt: '2026-10-22T08:00:00.000Z',
    updatedAt: '2026-10-22T08:00:00.000Z',
  }

  it('sends every column, null for an absent field, with the key from toKey', () => {
    expect(termToRow(term)).toStrictEqual({
      id: ID,
      file_id: FILE_ID,
      word: 'Don’t',
      word_key: "don't",
      part_of_speech: null,
      meaning: 'đừng',
      example: null,
      created_at: term.createdAt,
      updated_at: term.updatedAt,
    })
    expect(folderToRow({ id: ID, name: 'IELTS', createdAt: 'a', updatedAt: 'b' })).toStrictEqual({
      id: ID,
      name: 'IELTS',
      name_key: 'ielts',
      created_at: 'a',
      updated_at: 'b',
    })
  })

  it('replaces only content columns on edit, clearing removed fields', () => {
    expect(termContentToRow({ word: 'Run', meaning: 'chạy' })).toStrictEqual({
      word: 'Run',
      word_key: 'run',
      part_of_speech: null,
      meaning: 'chạy',
      example: null,
    })
  })

  it('round-trips through the read mapper', () => {
    const progress = {
      termId: ID,
      box: 2,
      correctCount: 1,
      wrongCount: 0,
      lastStudiedAt: '2026-10-22T08:00:00.000Z',
    }
    const row = entityToRow(TermProgressSchema, progress)
    expect(row).toStrictEqual({
      term_id: ID,
      box: 2,
      correct_count: 1,
      wrong_count: 0,
      last_wrong_at: null,
      last_studied_at: progress.lastStudiedAt,
    })
    expect(parseRow(TermProgressSchema, row, 'progress 0')).toStrictEqual(progress)
    expect(parseRow(TermSchema, termToRow(term), 'terms 0')).toStrictEqual(term)
  })
})
