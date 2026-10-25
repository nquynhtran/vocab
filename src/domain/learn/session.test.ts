import { describe, expect, it } from 'vitest'
import type { Term, TermProgress } from '../schemas.ts'
import type { Random } from './random.ts'
import type { TermSelector } from './selector.ts'
import {
  applyAnswer,
  currentTerm,
  doneCount,
  isRoundOver,
  isSessionOver,
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
/** Retry gap of 2; 0.999999 gives 3. */
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
  it('moves a right answer one level up and off the round', () => {
    const session = answer(start(3), true)
    expect(session.terms[0]).toMatchObject({ level: 1, missed: false })
    expect(words(session)).toEqual(['word 2', 'word 3'])
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
    const round1 = answer(start(1), true)
    expect(isRoundOver(round1)).toBe(true)
    const { session, promote } = applyAnswer(startRound(round1), true, low)
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
    session = startRound(session)
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
    const over = answer(start(1), true)
    expect(() => applyAnswer(over, true, low)).toThrow()
  })
})

describe('rounds', () => {
  it('takes the next terms not done yet, in study order, up to 7', () => {
    let session = start(9, [progressOf(1, 3)])
    for (let i = 0; i < ROUND_SIZE; i++) session = answer(session, true)
    session = startRound(session)
    expect(session.round).toBe(2)
    // word 1 is done (written → level 2); words 2-7 are at level 1; 8 and 9 never asked.
    expect(words(session)).toEqual([
      'word 2',
      'word 3',
      'word 4',
      'word 5',
      'word 6',
      'word 7',
      'word 8',
    ])
    expect(doneCount(session)).toBe(1)
  })

  it('ends the session only when every term is at level 2', () => {
    let session = start(2)
    while (!isSessionOver(session)) {
      session = isRoundOver(session) ? startRound(session) : answer(session, true)
    }
    expect(session.round).toBe(2)
    expect(session.answers).toHaveLength(4)
  })
})
