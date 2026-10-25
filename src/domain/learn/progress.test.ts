import { describe, expect, it } from 'vitest'
import type { TermProgress } from '../schemas.ts'
import type { AnswerRecord } from './answer.ts'
import { progressAfter } from './progress.ts'

const TERM_ID = '00000000-0000-4000-8000-000000000001'

function answer(overrides: Partial<AnswerRecord> = {}): AnswerRecord {
  return {
    termId: TERM_ID,
    correct: true,
    promote: false,
    answeredAt: '2026-10-25T09:00:00.000Z',
    day: '2026-10-25',
    ...overrides,
  }
}

const studied: TermProgress = {
  termId: TERM_ID,
  box: 3,
  correctCount: 4,
  wrongCount: 2,
  lastWrongAt: '2026-10-20T09:00:00.000Z',
  lastStudiedAt: '2026-10-24T09:00:00.000Z',
  lastPromotedDay: '2026-10-24',
}

describe('progressAfter', () => {
  it('starts a never studied term in box 1 with zero counts, then applies the answer', () => {
    expect(progressAfter(undefined, answer())).toStrictEqual({
      termId: TERM_ID,
      box: 1,
      correctCount: 1,
      wrongCount: 0,
      lastStudiedAt: '2026-10-25T09:00:00.000Z',
    })
    expect(progressAfter(undefined, answer({ promote: true }))).toMatchObject({
      box: 2,
      lastPromotedDay: '2026-10-25',
    })
  })

  it('sends a wrong answer back to box 1 and keeps the last promotion day', () => {
    expect(progressAfter(studied, answer({ correct: false }))).toStrictEqual({
      ...studied,
      box: 1,
      wrongCount: 3,
      lastWrongAt: '2026-10-25T09:00:00.000Z',
      lastStudiedAt: '2026-10-25T09:00:00.000Z',
    })
  })

  it('counts a correct answer without promote but leaves the box alone', () => {
    expect(progressAfter(studied, answer())).toStrictEqual({
      ...studied,
      correctCount: 5,
      lastStudiedAt: '2026-10-25T09:00:00.000Z',
    })
  })

  it('promotes one step on a new day, at most to box 5', () => {
    expect(progressAfter(studied, answer({ promote: true }))).toMatchObject({
      box: 4,
      lastPromotedDay: '2026-10-25',
    })
    expect(progressAfter({ ...studied, box: 5 }, answer({ promote: true }))).toMatchObject({
      box: 5,
      lastPromotedDay: '2026-10-25',
    })
  })

  it('does not promote twice on the same day, but still counts the answer', () => {
    const sameDay = { ...studied, lastPromotedDay: '2026-10-25' }
    expect(progressAfter(sameDay, answer({ promote: true }))).toStrictEqual({
      ...sameDay,
      correctCount: 5,
      lastStudiedAt: '2026-10-25T09:00:00.000Z',
    })
  })

  it('promotes on an earlier day too, so a clock set back cannot block it (#50)', () => {
    expect(progressAfter(studied, answer({ promote: true, day: '2026-10-01' }))).toMatchObject({
      box: 4,
      lastPromotedDay: '2026-10-01',
    })
  })

  it('ignores an answer already recorded, also when the same instant is written differently', () => {
    const retry = answer({ answeredAt: studied.lastStudiedAt, promote: true })
    expect(progressAfter(studied, retry)).toBeUndefined()
    expect(progressAfter(studied, { ...retry, answeredAt: '2026-10-24T09:00:00Z' })).toBeUndefined()
  })

  it('does not change the progress passed in', () => {
    const before = structuredClone(studied)
    progressAfter(studied, answer({ correct: false }))
    expect(studied).toStrictEqual(before)
  })
})
