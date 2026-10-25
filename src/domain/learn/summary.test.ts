import { describe, expect, it } from 'vitest'
import type { Term } from '../schemas.ts'
import type { LearnSession, SessionAnswer } from './session.ts'
import { MOST_MISSED_LIMIT, mostMissed, roundTallies, sessionTotals } from './summary.ts'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const term = (n: number): Term => ({
  id: id(n),
  fileId: id(999),
  word: `word ${n}`,
  meaning: `nghĩa ${n}`,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
})
const answer = (n: number, correct: boolean, round = 1): SessionAnswer => ({
  termId: id(n),
  correct,
  round,
})

/** Terms 1..count; only `answers` and `round` matter to the summaries. */
function sessionWith(count: number, answers: SessionAnswer[], round = 1): LearnSession {
  return {
    terms: Array.from({ length: count }, (_, i) => ({
      term: term(i + 1),
      level: 0,
      missed: false,
    })),
    round,
    queue: [],
    answers,
  }
}

describe('roundTallies', () => {
  it('counts each term of the current round in the order first asked', () => {
    const session = sessionWith(
      3,
      [
        answer(1, false, 1),
        answer(3, true, 2),
        answer(2, false, 2),
        answer(3, true, 2),
        answer(2, true, 2),
      ],
      2,
    )
    expect(roundTallies(session)).toStrictEqual([
      { term: term(3), correct: 2, wrong: 0 },
      { term: term(2), correct: 1, wrong: 1 },
    ])
  })

  it('is empty before any answer of the round', () => {
    expect(roundTallies(sessionWith(2, [answer(1, true, 1)], 2))).toStrictEqual([])
  })
})

describe('sessionTotals', () => {
  it('counts every answer of every round', () => {
    const session = sessionWith(2, [answer(1, false, 1), answer(1, true, 1), answer(2, true, 2)], 2)
    expect(sessionTotals(session)).toStrictEqual({ correct: 2, wrong: 1 })
  })
})

describe('mostMissed', () => {
  it('lists only missed terms, most misses first, ties in the order first asked', () => {
    const session = sessionWith(4, [
      answer(1, true),
      answer(2, false),
      answer(3, false),
      answer(3, false, 2),
      answer(4, false, 2),
      answer(2, true, 2),
    ])
    expect(mostMissed(session)).toStrictEqual([
      { term: term(3), correct: 0, wrong: 2 },
      { term: term(2), correct: 1, wrong: 1 },
      { term: term(4), correct: 0, wrong: 1 },
    ])
  })

  it(`keeps at most ${MOST_MISSED_LIMIT}`, () => {
    const count = MOST_MISSED_LIMIT + 2
    const answers = Array.from({ length: count }, (_, i) => answer(i + 1, false))
    const missed = mostMissed(sessionWith(count, answers))
    expect(missed.map((entry) => entry.term.id)).toStrictEqual(
      answers.slice(0, MOST_MISSED_LIMIT).map((a) => a.termId),
    )
  })
})
