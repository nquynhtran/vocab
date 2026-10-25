import type { Term } from '../schemas.ts'
import type { LearnSession, SessionAnswer } from './session.ts'

/** How often one term was answered right and wrong. */
export interface TermTally {
  term: Term
  correct: number
  wrong: number
}

/** The session summary lists at most this many of the terms missed most. */
export const MOST_MISSED_LIMIT = 5

/** Every term answered in the current round, in the order first asked (the round summary). */
export function roundTallies(session: LearnSession): TermTally[] {
  return tally(
    session,
    session.answers.filter((answer) => answer.round === session.round),
  )
}

export function sessionTotals(session: LearnSession): { correct: number; wrong: number } {
  const correct = session.answers.filter((answer) => answer.correct).length
  return { correct, wrong: session.answers.length - correct }
}

/** Terms missed at least once, most misses first; ties keep the order first asked. */
export function mostMissed(session: LearnSession): TermTally[] {
  return tally(session, session.answers)
    .filter((entry) => entry.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong)
    .slice(0, MOST_MISSED_LIMIT)
}

function tally(session: LearnSession, answers: readonly SessionAnswer[]): TermTally[] {
  const terms = new Map(session.terms.map((entry) => [entry.term.id, entry.term]))
  // A Map keeps insertion order, i.e. the order terms were first asked.
  const counts = new Map<string, TermTally>()
  for (const answer of answers) {
    const term = terms.get(answer.termId)
    if (term === undefined) continue
    const previous = counts.get(answer.termId) ?? { term, correct: 0, wrong: 0 }
    counts.set(
      answer.termId,
      answer.correct
        ? { ...previous, correct: previous.correct + 1 }
        : { ...previous, wrong: previous.wrong + 1 },
    )
  }
  return [...counts.values()]
}
