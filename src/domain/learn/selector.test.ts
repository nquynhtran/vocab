import { describe, expect, it } from 'vitest'
import type { Term, TermProgress } from '../schemas.ts'
import { leitnerSelector, priority } from './selector.ts'

const TODAY = '2026-10-25'
const noRandom = () => 0
const studied = (box: number, extra: Partial<TermProgress> = {}): TermProgress => ({
  termId: '00000000-0000-4000-8000-000000000001',
  box,
  correctCount: 0,
  wrongCount: 0,
  lastStudiedAt: '2026-10-25T03:00:00.000Z',
  ...extra,
})

describe('priority', () => {
  it('follows the formula for a term never studied', () => {
    // (6 - 1) × 10 + 0 + 0 + 5 + 0
    expect(priority(undefined, TODAY, noRandom)).toBe(55)
  })

  it('puts lower boxes first', () => {
    expect(priority(studied(1), TODAY, noRandom)).toBe(50)
    expect(priority(studied(5), TODAY, noRandom)).toBe(10)
  })

  it('adds 3 per mistake, at most 5 mistakes', () => {
    expect(priority(studied(2, { wrongCount: 2 }), TODAY, noRandom)).toBe(46)
    expect(priority(studied(2, { wrongCount: 50 }), TODAY, noRandom)).toBe(55)
  })

  it('adds a point per local calendar day since last studied, at most 30', () => {
    // 2026-10-24 23:30 at UTC+7 (the test zone) is still the 24th locally, so one day ago.
    const lateYesterday = studied(5, { lastStudiedAt: '2026-10-24T16:30:00.000Z' })
    expect(priority(lateYesterday, TODAY, noRandom)).toBe(11)
    const longAgo = studied(5, { lastStudiedAt: '2025-01-01T00:00:00.000Z' })
    expect(priority(longAgo, TODAY, noRandom)).toBe(40)
  })

  it('does not go below zero days when the clock was ahead', () => {
    const future = studied(5, { lastStudiedAt: '2026-11-01T00:00:00.000Z' })
    expect(priority(future, TODAY, noRandom)).toBe(10)
  })

  it('adds 0 to 3 at random', () => {
    expect(priority(studied(5), TODAY, () => 0.999999)).toBe(13)
  })
})

describe('leitnerSelector', () => {
  const term = (n: number): Term => ({
    id: `00000000-0000-4000-8000-00000000000${n}`,
    fileId: '00000000-0000-4000-8000-000000000099',
    word: `word ${n}`,
    meaning: `nghĩa ${n}`,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  })

  it('orders by priority, highest first, and keeps the input as is', () => {
    const terms = [term(1), term(2), term(3)]
    const progress = new Map([
      [term(1).id, studied(5, { termId: term(1).id })],
      [term(3).id, studied(2, { termId: term(3).id })],
    ])
    const ordered = leitnerSelector.order(terms, progress, TODAY, noRandom)
    expect(ordered.map((t) => t.id)).toEqual([term(2).id, term(3).id, term(1).id])
    expect(terms.map((t) => t.id)).toEqual([term(1).id, term(2).id, term(3).id])
  })
})
