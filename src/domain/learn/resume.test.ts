import { describe, expect, it } from 'vitest'
import type { Term, TermProgress } from '../schemas.ts'
import type { Random } from './random.ts'
import { resumeSession, SavedSessionSchema, toSaved, type SavedSession } from './resume.ts'
import type { TermSelector } from './selector.ts'
import {
  applyAnswer,
  currentTerm,
  progressCounts,
  startSession,
  type LearnSession,
} from './session.ts'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const term = (n: number, word = `word ${n}`): Term => ({
  id: id(n),
  fileId: id(999),
  word,
  meaning: `nghĩa ${n}`,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
})
const mastered = (n: number): TermProgress => ({
  termId: id(n),
  box: 3,
  correctCount: 2,
  wrongCount: 0,
})
const asGiven: TermSelector = { order: (terms) => [...terms] }
const low: Random = () => 0
const now = new Date('2026-11-03T05:00:00.000Z')
const NO_PROGRESS = new Map<string, TermProgress>()

function start(terms: Term[]): LearnSession {
  return startSession({
    terms,
    progress: NO_PROGRESS,
    today: '2026-11-03',
    random: low,
    selector: asGiven,
  })
}
const answer = (session: LearnSession, correct: boolean) =>
  applyAnswer(session, correct, low).session

/** Through JSON, as localStorage keeps it. */
const roundTrip = (session: LearnSession): SavedSession =>
  SavedSessionSchema.parse(JSON.parse(JSON.stringify(toSaved(session, now))))

const TERMS = [1, 2, 3, 4, 5].map((n) => term(n))

/** Mid-round: word 1 missed and back at level 0, word 2 at level 1 waiting for its written question. */
function midRound(): LearnSession {
  let session = answer(start(TERMS), false) // word 1 missed, back after 2
  session = answer(session, true) // word 2 → level 1, back after 3
  return session
}

describe('toSaved → resumeSession', () => {
  it('gives back the same session, mid-round, through JSON', () => {
    const session = midRound()
    expect(session.queue).toContain(id(2))
    const resumed = resumeSession({
      saved: roundTrip(session),
      terms: TERMS,
      progress: NO_PROGRESS,
    })
    expect(resumed).toStrictEqual(session)
  })

  it('keeps "missed", so a term missed before the stop still earns no box', () => {
    let session = resumeSession({
      saved: roundTrip(midRound()),
      terms: TERMS,
      progress: NO_PROGRESS,
    })!
    while (currentTerm(session)?.term.id !== id(1)) session = answer(session, true)
    session = answer(session, true) // word 1 → level 1
    while (currentTerm(session)?.term.id !== id(1)) session = answer(session, true)
    const { promote, session: after } = applyAnswer(session, true, low)
    expect(after.terms.find((entry) => entry.term.id === id(1))?.level).toBe(2)
    expect(promote).toBe(false)
  })
})

describe('resumeSession merges with the file as it is now', () => {
  it('drops a deleted term from the terms, the queue and the answers', () => {
    const session = midRound()
    expect(session.answers.map((answer) => answer.termId)).toContain(id(2))
    const terms = TERMS.filter((t) => t.id !== id(2))
    const resumed = resumeSession({ saved: roundTrip(session), terms, progress: NO_PROGRESS })!
    expect(resumed.terms.map((entry) => entry.term.id)).not.toContain(id(2))
    expect(resumed.queue).toEqual(session.queue.filter((termId) => termId !== id(2)))
    expect(resumed.answers).toEqual(session.answers.filter((a) => a.termId !== id(2)))
  })

  it('drops the current question when its term was deleted', () => {
    const session = midRound()
    const first = session.queue[0]!
    const terms = TERMS.filter((t) => t.id !== first)
    const resumed = resumeSession({ saved: roundTrip(session), terms, progress: NO_PROGRESS })!
    expect(resumed.queue).toEqual(session.queue.slice(1))
  })

  it('starts the next round when every term left in the queue was deleted', () => {
    const session = answer(start([term(1), term(2)]), true) // word 1 → level 1, queue [2, 1]
    const terms = [term(3)] // 1 and 2 deleted, 3 added
    const progress = new Map([[id(3), mastered(3)]])
    // Word 1 holds the only answer and is gone: nothing worth continuing.
    expect(resumeSession({ saved: roundTrip(session), terms, progress })).toBeUndefined()

    // Word 2 → level 1, then word 1 → level 2: only word 2 is left in the queue.
    const twoLeft = answer(answer(session, true), true)
    expect(twoLeft.queue).toEqual([id(2)])
    const resumed = resumeSession({
      saved: roundTrip(twoLeft),
      terms: [term(1), term(3)],
      progress,
    })!
    expect(resumed.round).toBe(2)
    expect(resumed.queue).toEqual([id(3)])
  })

  it('adds new terms at the end, mastered ones at the written level', () => {
    const terms = [...TERMS, term(6), term(7)]
    const progress = new Map([[id(7), mastered(7)]])
    const resumed = resumeSession({ saved: roundTrip(midRound()), terms, progress })!
    expect(resumed.terms.slice(-2)).toStrictEqual([
      { term: term(6), level: 0, missed: false },
      { term: term(7), level: 1, missed: false },
    ])
  })

  it('takes the words as they are now', () => {
    const terms = TERMS.map((t) => (t.id === id(2) ? term(2, 'renamed') : t))
    const resumed = resumeSession({ saved: roundTrip(midRound()), terms, progress: NO_PROGRESS })!
    expect(resumed.terms[1]!.term.word).toBe('renamed')
  })

  it('has nothing to continue when every term is learned', () => {
    let session = start([term(1)])
    session = answer(answer(session, true), true)
    expect(progressCounts(session).learned).toBe(1)
    expect(
      resumeSession({ saved: roundTrip(session), terms: [term(1)], progress: NO_PROGRESS }),
    ).toBeUndefined()
  })
})

describe('SavedSessionSchema', () => {
  const valid = () => toSaved(midRound(), now)
  const broken: [string, (saved: SavedSession) => unknown][] = [
    ['another version', (s) => ({ ...s, version: 2 })],
    ['round 0', (s) => ({ ...s, round: 0, answers: [] })],
    ['a term twice', (s) => ({ ...s, terms: [...s.terms, s.terms[0]] })],
    ['a queue id twice', (s) => ({ ...s, queue: [...s.queue, s.queue[0]] })],
    ['an unknown id in the queue', (s) => ({ ...s, queue: [...s.queue, id(42)] })],
    [
      'a learned term in the queue',
      (s) => ({ ...s, terms: s.terms.map((t) => ({ ...t, level: 2 })) }),
    ],
    [
      'an answer for an unknown term',
      (s) => ({ ...s, answers: [{ ...s.answers[0], termId: id(42) }] }),
    ],
    ['an answer from a later round', (s) => ({ ...s, answers: [{ ...s.answers[0], round: 2 }] })],
    ['level 3', (s) => ({ ...s, terms: [{ ...s.terms[0], level: 3 }, ...s.terms.slice(1)] })],
    [
      'no savedAt',
      (s) => {
        const { savedAt: _, ...rest } = s
        return rest
      },
    ],
  ]

  it('accepts what toSaved writes', () => {
    expect(SavedSessionSchema.parse(valid())).toStrictEqual(valid())
  })

  it.each(broken)('rejects %s', (_case, breakIt) => {
    expect(SavedSessionSchema.safeParse(breakIt(valid())).success).toBe(false)
  })
})
