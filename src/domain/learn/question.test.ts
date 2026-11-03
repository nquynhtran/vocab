import { describe, expect, it } from 'vitest'
import type { Term } from '../schemas.ts'
import { buildQuestion } from './question.ts'
import type { SessionTerm } from './session.ts'

const run: Term = {
  id: '00000000-0000-4000-8000-000000000001',
  fileId: '00000000-0000-4000-8000-000000000099',
  word: 'run',
  partOfSpeech: 'verb',
  meaning: 'chạy',
  example: 'I run every day.',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
}
const at = (level: SessionTerm['level'], term = run): SessionTerm => ({
  term,
  level,
  missed: false,
})
const others = [
  { word: 'walk', meaning: 'đi bộ' },
  { word: 'swim', meaning: 'bơi' },
]

describe('buildQuestion', () => {
  it('asks multiple choice at level 0, with the part of speech and example (#61, #57)', () => {
    const question = buildQuestion(at(0), [run, ...others], [], Math.random)
    expect(question).toMatchObject({
      kind: 'choice',
      termId: run.id,
      meaning: 'chạy',
      partOfSpeech: 'verb',
      example: 'I ____ every day.',
      word: 'run',
    })
    expect(question.kind === 'choice' && [...question.choices].sort()).toEqual([
      'run',
      'swim',
      'walk',
    ])
  })

  it('carries the pronunciation for the feedback, and leaves it out when there is none', () => {
    const withIpa = { ...run, pronunciation: '/rʌn/' }
    expect(buildQuestion(at(0, withIpa), [withIpa, ...others], [], Math.random)).toMatchObject({
      pronunciation: '/rʌn/',
    })
    expect(buildQuestion(at(1), [run, ...others], [], Math.random)).not.toHaveProperty(
      'pronunciation',
    )
  })

  it('asks written at level 1, with the word hidden in the example', () => {
    expect(buildQuestion(at(1), [run, ...others], [], Math.random)).toStrictEqual({
      kind: 'written',
      termId: run.id,
      meaning: 'chạy',
      partOfSpeech: 'verb',
      word: 'run',
      example: 'I ____ every day.',
    })
  })

  it('leaves the example out when the word cannot be hidden in it', () => {
    const ran = (level: SessionTerm['level']) => ({
      ...at(level),
      term: { ...run, example: 'I ran home.' },
    })
    expect(buildQuestion(ran(1), [], [], Math.random)).not.toHaveProperty('example')
    const choice = buildQuestion(ran(0), [run, ...others], [], Math.random)
    expect(choice).toMatchObject({ kind: 'choice' })
    expect(choice).not.toHaveProperty('example')
  })

  it('leaves the part of speech out when the term has none', () => {
    const { partOfSpeech: _, ...plain } = run
    const question = buildQuestion({ ...at(1), term: plain }, [], [], Math.random)
    expect(question).not.toHaveProperty('partOfSpeech')
  })

  it('asks written at level 0 when no distractor is usable', () => {
    expect(buildQuestion(at(0), [run], [], Math.random)).toMatchObject({ kind: 'written' })
  })
})
