import { describe, expect, it } from 'vitest'
import type { Term, TermProgress } from '../schemas.ts'
import type { Random } from './random.ts'
import type { TermSelector } from './selector.ts'
import {
  applyAnswer,
  currentTerm,
  isRoundOver,
  isSessionOver,
  progressCounts,
  ROUND_SIZE,
  startRound,
  startSession,
  type LearnSession,
} from './session.ts'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const term = (n: number): Term => ({
  id: id(n),
  fileId: id(999),
  word: `word ${n}`,
  meaning: `nghĩa ${n}`,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
})
const progressOf = (n: number, box: number): TermProgress => ({
  termId: id(n),
  box,
  correctCount: 0,
  wrongCount: 0,
})
/** Keeps the input order, so tests read in the order terms are given. */
const asGiven: TermSelector = { order: (terms) => [...terms] }
/** Gaps at their smallest: retry after 2, written after 3. 0.999999 gives 3 and 4. */
const low: Random = () => 0

function start(count: number, progress: TermProgress[] = []): LearnSession {
  return startSession({
    terms: Array.from({ length: count }, (_, i) => term(i + 1)),
    progress: new Map(progress.map((p) => [p.termId, p])),
    today: '2026-10-25',
    random: low,
    selector: asGiven,
  })
}

/** Answers the current question and returns the next session. */
const answer = (session: LearnSession, correct: boolean, random: Random = low) =>
  applyAnswer(session, correct, random).session

const words = (session: LearnSession) =>
  session.queue.map((termId) => session.terms.find((t) => t.term.id === termId)!.term.word)

/** Answers right until the round is over; returns `word@level` for each question asked. */
function askedThroughRound(session: LearnSession): { session: LearnSession; asked: string[] } {
  const asked: string[] = []
  while (!isRoundOver(session)) {
    const current = currentTerm(session)!
    asked.push(`${current.term.word.replace('word ', '')}@${current.level}`)
    session = answer(session, true)
  }
  return { session, asked }
}

describe('startSession', () => {
  it('starts round 1 with the first 7 terms in study order', () => {
    const session = start(9)
    expect(session.round).toBe(1)
    expect(session.queue).toHaveLength(ROUND_SIZE)
    expect(currentTerm(session)?.term.id).toBe(id(1))
  })

  it('starts mastered terms (box ≥ 3) at the written level, others at multiple choice', () => {
    const session = start(3, [progressOf(1, 3), progressOf(2, 2)])
    expect(session.terms.map((t) => t.level)).toEqual([1, 0, 0])
  })

  it('uses the given order and the default Leitner order otherwise', () => {
    const terms = [term(1), term(2)]
    const session = startSession({
      terms,
      progress: new Map([[id(1), progressOf(1, 5)]]),
      today: '2026-10-25',
      random: low,
    })
    expect(session.terms.map((t) => t.term.id)).toEqual([id(2), id(1)])
  })

  it('refuses an empty file', () => {
    expect(() => start(0)).toThrow()
  })
})

describe('applyAnswer', () => {
  it('asks a term right in multiple choice again, written, after 3 or 4 questions (#56)', () => {
    const session = answer(start(6), true)
    expect(session.terms[0]).toMatchObject({ level: 1, missed: false })
    expect(words(session)).toEqual(['word 2', 'word 3', 'word 4', 'word 1', 'word 5', 'word 6'])
    expect(words(answer(start(6), true, () => 0.999999))).toEqual([
      'word 2',
      'word 3',
      'word 4',
      'word 5',
      'word 1',
      'word 6',
    ])
  })

  it('takes a term right in its written question off the round', () => {
    const session = answer(start(3, [progressOf(1, 3)]), true)
    expect(session.terms[0]).toMatchObject({ level: 2, missed: false })
    expect(words(session)).toEqual(['word 2', 'word 3'])
  })

  it('puts a term right in multiple choice last when fewer questions are left', () => {
    expect(words(answer(start(2), true))).toEqual(['word 2', 'word 1'])
    expect(words(answer(start(1), true))).toEqual(['word 1'])
  })

  it('after a miss, asks the written question with the written gap', () => {
    let session = answer(start(6), false) // word 1 after 2 others
    session = answer(answer(session, true), true) // words 2 and 3
    expect(currentTerm(session)).toMatchObject({ term: { word: 'word 1' }, level: 0 })
    session = answer(session, true)
    expect(words(session).indexOf('word 1')).toBe(3)
  })

  it('sends a wrong answer back to level 0 and asks it again after 2 or 3 questions', () => {
    const written = start(5, [progressOf(1, 4)])
    const afterTwo = answer(written, false, () => 0)
    expect(afterTwo.terms[0]).toMatchObject({ level: 0, missed: true })
    expect(words(afterTwo)).toEqual(['word 2', 'word 3', 'word 1', 'word 4', 'word 5'])
    expect(words(answer(written, false, () => 0.999999))).toEqual([
      'word 2',
      'word 3',
      'word 4',
      'word 1',
      'word 5',
    ])
  })

  it('puts a missed term last when fewer questions are left', () => {
    expect(words(answer(start(2), false))).toEqual(['word 2', 'word 1'])
  })

  it('asks a missed term again right away when it is the only one left', () => {
    expect(words(answer(start(1), false))).toEqual(['word 1'])
  })

  it('promotes a term reaching level 2 without a mistake this session', () => {
    const { session, promote } = applyAnswer(answer(start(1), true), true, low)
    expect(promote).toBe(true)
    expect(session.terms[0]!.level).toBe(2)
    expect(isSessionOver(session)).toBe(true)
  })

  it('never promotes before level 2', () => {
    expect(applyAnswer(start(1), true, low).promote).toBe(false)
  })

  it('does not promote a term missed earlier in the session', () => {
    let session = answer(start(1), false)
    session = answer(session, true) // level 1
    const { promote, session: done } = applyAnswer(session, true, low)
    expect(done.terms[0]!.level).toBe(2)
    expect(promote).toBe(false)
  })

  it('promotes a mastered term after one right written answer', () => {
    expect(applyAnswer(start(1, [progressOf(1, 3)]), true, low).promote).toBe(true)
  })

  it('"I was right": applying `true` instead of the wrong grade leaves no trace of it', () => {
    const corrected = applyAnswer(start(2, [progressOf(1, 3)]), true, low)
    expect(corrected.promote).toBe(true)
    expect(corrected.session.terms[0]).toMatchObject({ level: 2, missed: false })
    expect(words(corrected.session)).toEqual(['word 2'])
    expect(corrected.session.answers).toEqual([{ termId: id(1), correct: true, round: 1 }])
  })

  it('records every answer with its round', () => {
    let session = answer(start(2), false)
    session = answer(session, true)
    expect(session.answers).toEqual([
      { termId: id(1), correct: false, round: 1 },
      { termId: id(2), correct: true, round: 1 },
    ])
  })

  it('leaves the session passed in unchanged', () => {
    const session = start(2)
    const before = structuredClone(session)
    answer(session, false)
    expect(session).toStrictEqual(before)
  })

  it('refuses an answer when the round is over', () => {
    const over = answer(start(1, [progressOf(1, 3)]), true)
    expect(isRoundOver(over)).toBe(true)
    expect(() => applyAnswer(over, true, low)).toThrow()
  })
})

describe('rounds', () => {
  it('mixes written questions in with the multiple choice of other terms (#56)', () => {
    const { asked } = askedThroughRound(start(ROUND_SIZE))
    // prettier-ignore
    expect(asked).toEqual([
      '1@0', '2@0', '3@0', '4@0', '1@1', '2@1', '3@1', '4@1',
      '5@0', '6@0', '7@0', '5@1', '6@1', '7@1',
    ])
  })

  it('ends a round when its terms are all learned, then takes the next ones', () => {
    const { session } = askedThroughRound(start(9, [progressOf(1, 3)]))
    expect(progressCounts(session)).toEqual({ learned: ROUND_SIZE, familiar: 0 })
    const round2 = startRound(session)
    expect(round2.round).toBe(2)
    expect(words(round2)).toEqual(['word 8', 'word 9'])
  })

  it('ends the session only when every term is at level 2', () => {
    let session = start(ROUND_SIZE + 1)
    while (!isSessionOver(session)) {
      session = isRoundOver(session) ? startRound(session) : answer(session, true)
    }
    expect(session.round).toBe(2)
    expect(session.answers).toHaveLength(2 * (ROUND_SIZE + 1))
  })
})

describe('progressCounts', () => {
  it('counts terms learned (level 2) and familiar (level 1) apart', () => {
    let session = start(4, [progressOf(4, 3)]) // word 4 starts familiar
    expect(progressCounts(session)).toEqual({ learned: 0, familiar: 1 })
    session = answer(session, true) // word 1 familiar
    expect(progressCounts(session)).toEqual({ learned: 0, familiar: 2 })
    session = answer(answer(answer(session, true), true), true) // words 2, 3 familiar; word 4 written
    expect(progressCounts(session)).toEqual({ learned: 1, familiar: 3 })
  })
})
