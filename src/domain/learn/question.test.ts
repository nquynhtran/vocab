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
const at = (level: SessionTerm['level']): SessionTerm => ({ term: run, level, missed: false })
const others = [
  { word: 'walk', meaning: 'đi bộ' },
  { word: 'swim', meaning: 'bơi' },
]

describe('buildQuestion', () => {
  it('asks multiple choice at level 0, without the part of speech', () => {
    const question = buildQuestion(at(0), [run, ...others], [], Math.random)
    expect(question).toMatchObject({ kind: 'choice', termId: run.id, meaning: 'chạy', word: 'run' })
    expect(question.kind === 'choice' && [...question.choices].sort()).toEqual([
      'run',
      'swim',
      'walk',
    ])
    expect(question).not.toHaveProperty('partOfSpeech')
  })

  it('asks written at level 1, with the word hidden in the example', () => {
    expect(buildQuestion(at(1), [run, ...others], [], Math.random)).toStrictEqual({
      kind: 'written',
      termId: run.id,
      meaning: 'chạy',
      word: 'run',
      example: 'I ____ every day.',
    })
  })

  it('leaves the example out when the word cannot be hidden in it', () => {
    const ran = { ...at(1), term: { ...run, example: 'I ran home.' } }
    expect(buildQuestion(ran, [], [], Math.random)).not.toHaveProperty('example')
  })

  it('asks written at level 0 when no distractor is usable', () => {
    expect(buildQuestion(at(0), [run], [], Math.random)).toMatchObject({ kind: 'written' })
  })
})
