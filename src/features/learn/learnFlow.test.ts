import { describe, expect, it } from 'vitest'
import type { Term, TermProgress } from '../../domain/schemas.ts'
import type { Random } from '../../domain/learn/random.ts'
import { ROUND_SIZE } from '../../domain/learn/session.ts'
import {
  continueOn,
  finishPause,
  nextRound,
  overrule,
  pickChoice,
  retry,
  saveFailed,
  saveSucceeded,
  startLearn,
  stop,
  submitWritten,
  type LearnState,
} from './learnFlow.ts'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const term = (n: number): Term => ({
  id: id(n),
  fileId: id(999),
  word: `word${n}`,
  meaning: `nghĩa ${n}`,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
})
const mastered = (n: number): TermProgress => ({
  termId: id(n),
  box: 3,
  correctCount: 3,
  wrongCount: 0,
})
const distractors = [1, 2, 3].map((n) => ({ word: `other${n}`, meaning: `khác ${n}` }))
const now = new Date('2026-10-25T03:00:00.000Z')
const low: Random = () => 0

function start(count: number, progress: TermProgress[] = []): LearnState {
  const terms = Array.from({ length: count }, (_, i) => term(i + 1))
  return startLearn({ terms, progress, distractors }, now, low)
}

function question(state: LearnState) {
  if (state.step.kind !== 'question') throw new Error(`expected a question, got ${state.step.kind}`)
  return state.step.question
}

/** Picks the right or a wrong option, then lets the save succeed. */
function pick(state: LearnState, correct: boolean): LearnState {
  const asked = question(state)
  if (asked.kind !== 'choice') throw new Error('expected multiple choice')
  const choice = correct ? asked.word : asked.choices.find((c) => c !== asked.word)!
  return saved(pickChoice(state, choice, now, low))
}

function saved(state: LearnState): LearnState {
  if (state.step.kind !== 'saving') throw new Error(`expected saving, got ${state.step.kind}`)
  return saveSucceeded(state, state.step.save)
}

function record(state: LearnState) {
  if (state.step.kind !== 'saving') throw new Error(`expected saving, got ${state.step.kind}`)
  return state.step.save.record
}

/** Answers every question right until the round or session is over. */
function answerAllRight(state: LearnState): LearnState {
  let current = state
  while (current.step.kind === 'question') {
    const asked = current.step.question
    current =
      asked.kind === 'choice'
        ? finishPause(pick(current, true))
        : saved(continueOn(submitWritten(current, asked.word), now, low))
  }
  return current
}

describe('multiple choice', () => {
  it('saves a right answer at once, shows it, then moves on', () => {
    const state = start(2)
    const asked = question(state)
    const saving = pickChoice(state, asked.word, now, low)
    expect(record(saving)).toStrictEqual({
      termId: asked.termId,
      correct: true,
      promote: false,
      answeredAt: now.toISOString(),
      day: '2026-10-25',
    })
    // The progress bar moves only once the answer is stored.
    expect(saving.session).toBe(state.session)

    const shown = saveSucceeded(saving, saving.step.kind === 'saving' ? saving.step.save : never())
    expect(shown.step.kind).toBe('correct')
    expect(shown.session.answers).toHaveLength(1)
    expect(question(finishPause(shown)).termId).not.toBe(asked.termId)
  })

  it('saves a wrong answer at once, then waits on feedback for Continue', () => {
    const state = start(2)
    const asked = question(state)
    const wrong = pickChoice(state, 'other1', now, low)
    expect(record(wrong)).toMatchObject({ termId: asked.termId, correct: false, promote: false })

    const feedback = saved(wrong)
    expect(feedback.step).toMatchObject({
      kind: 'feedback',
      answered: { given: 'other1', grade: 'wrong' },
    })
    // Already stored: "I was right" does not apply, and Continue saves nothing more.
    expect(overrule(feedback)).toBe(feedback)
    expect(continueOn(feedback, now, low).step.kind).toBe('question')
  })

  it('ignores a second pick while the first is being saved', () => {
    const saving = pickChoice(start(2), 'other1', now, low)
    expect(pickChoice(saving, 'other2', now, low)).toBe(saving)
  })
})

describe('written', () => {
  it('saves nothing until Continue, then the final result', () => {
    // Mastered terms start at level 1: written questions.
    const state = start(1, [mastered(1)])
    expect(question(state).kind).toBe('written')

    const feedback = submitWritten(state, 'nope')
    expect(feedback.step).toMatchObject({ kind: 'feedback', answered: { grade: 'wrong' } })
    expect(feedback.session).toBe(state.session)

    const saving = continueOn(feedback, now, low)
    expect(record(saving)).toMatchObject({ correct: false, promote: false })
    expect(saved(saving).step.kind).toBe('question')
  })

  it('"I was right" counts the answer as right and can promote', () => {
    const feedback = overrule(submitWritten(start(1, [mastered(1)]), 'synonym'))
    expect(feedback.step).toMatchObject({ answered: { grade: 'wrong', overridden: true } })
    const saving = continueOn(feedback, now, low)
    expect(record(saving)).toMatchObject({ correct: true, promote: true })
    expect(saved(saving).step.kind).toBe('sessionOver')
  })

  it('offers "I was right" only for a wrong grade', () => {
    for (const [given, grade] of [
      ['word1', 'correct'],
      ['word', 'almost'],
    ] as const) {
      const feedback = submitWritten(start(1, [mastered(1)]), given)
      expect(feedback.step).toMatchObject({ answered: { grade } })
      expect(overrule(feedback)).toBe(feedback)
    }
  })

  it('counts one typo in a longer word as right', () => {
    const state = startLearn(
      { terms: [{ ...term(1), word: 'garden' }], progress: [mastered(1)], distractors },
      now,
      low,
    )
    const feedback = submitWritten(state, 'gardn')
    expect(feedback.step).toMatchObject({ answered: { grade: 'almost' } })
    expect(record(continueOn(feedback, now, low))).toMatchObject({ correct: true })
  })
})

describe('saving', () => {
  it('a failed save keeps the question; Retry sends the same record', () => {
    const saving = pickChoice(start(2), 'other1', now, low)
    if (saving.step.kind !== 'saving') never()
    const failed = saveFailed(saving, saving.step.save, new Error('offline'))
    expect(failed.step.kind).toBe('saveFailed')
    expect(failed.session).toBe(saving.session)

    const again = retry(failed)
    expect(again.step).toMatchObject({ kind: 'saving' })
    if (again.step.kind !== 'saving') never()
    expect(again.step.save).toBe(saving.step.save)
    expect(saveSucceeded(again, again.step.save).step.kind).toBe('feedback')
  })

  it('ignores the result of a save that is no longer the current one', () => {
    const saving = pickChoice(start(2), 'other1', now, low)
    const stale = { ...(saving.step.kind === 'saving' ? saving.step.save : never()) }
    expect(saveSucceeded(saving, stale)).toBe(saving)
    expect(saveFailed(saving, stale, new Error('late'))).toBe(saving)
  })
})

describe('stop', () => {
  it('ends the session from a question or a failed save', () => {
    const state = start(2)
    expect(stop(state).step.kind).toBe('sessionOver')
    const saving = pickChoice(state, 'other1', now, low)
    if (saving.step.kind !== 'saving') never()
    expect(stop(saveFailed(saving, saving.step.save, new Error())).step.kind).toBe('sessionOver')
  })

  it('is ignored while saving and on feedback', () => {
    const saving = pickChoice(start(2), 'other1', now, low)
    expect(stop(saving)).toBe(saving)
    const feedback = saved(saving)
    expect(stop(feedback)).toBe(feedback)
  })
})

describe('rounds', () => {
  it(`asks up to ${ROUND_SIZE} terms a round, then the next round, until all are learned`, () => {
    let state = answerAllRight(start(ROUND_SIZE + 1))
    // Round 1: everyone answered once (level 0 → 1), so the round ends but the session does not.
    expect(state.step.kind).toBe('roundOver')
    expect(state.session.answers).toHaveLength(ROUND_SIZE)
    expect(nextRound(state, low).session.round).toBe(2)

    while (state.step.kind === 'roundOver') state = answerAllRight(nextRound(state, low))
    expect(state.step.kind).toBe('sessionOver')
    expect(state.session.terms.every((entry) => entry.level === 2)).toBe(true)
  })

  it('asks written when no distractor is usable, even at level 0', () => {
    const state = startLearn({ terms: [term(1)], progress: [], distractors: [] }, now, low)
    expect(question(state).kind).toBe('written')
  })

  it('next round only applies after a round is over', () => {
    const state = start(2)
    expect(nextRound(state, low)).toBe(state)
  })
})

/** Narrows `Step` in tests where the kind was just checked. */
function never(): never {
  throw new Error('unexpected step')
}
