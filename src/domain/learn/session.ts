import { MASTERED_BOX } from '../mastery.ts'
import type { Term, TermProgress } from '../schemas.ts'
import { randomInt, type Random } from './random.ts'
import { leitnerSelector, type TermSelector } from './selector.ts'

/** 0: multiple choice next · 1: written next · 2: done for this session. In memory only. */
export type Level = 0 | 1 | 2
export const DONE_LEVEL = 2

export const ROUND_SIZE = 7
/** A missed term comes back after this many other questions, picked at random. */
const RETRY_GAP_MIN = 2
const RETRY_GAP_MAX = 3

export interface SessionTerm {
  term: Term
  level: Level
  /** Any mistake this session: such a term reaches level 2 without promoting its box. */
  missed: boolean
}

export interface SessionAnswer {
  termId: string
  correct: boolean
  round: number
}

/**
 * A Learn session (docs/learn-algorithm.md#một-phiên-học). Every function returns a new
 * session; none changes the one passed in.
 */
export interface LearnSession {
  /** In study order, decided once when the session starts. */
  terms: readonly SessionTerm[]
  round: number
  /** Term ids still to ask this round, the current question first. */
  queue: readonly string[]
  answers: readonly SessionAnswer[]
}

export interface StartSessionInput {
  terms: readonly Term[]
  progress: ReadonlyMap<string, TermProgress>
  today: string
  random: Random
  selector?: TermSelector
}

/** Starts with round 1. Terms already mastered go straight to written questions. */
export function startSession({
  terms,
  progress,
  today,
  random,
  selector = leitnerSelector,
}: StartSessionInput): LearnSession {
  if (terms.length === 0) throw new Error('A Learn session needs at least one term')
  const ordered = selector.order(terms, progress, today, random).map((term): SessionTerm => ({
    term,
    level: (progress.get(term.id)?.box ?? 1) >= MASTERED_BOX ? 1 : 0,
    missed: false,
  }))
  return startRound({ terms: ordered, round: 0, queue: [], answers: [] })
}

export function currentTerm(session: LearnSession): SessionTerm | undefined {
  const id = session.queue[0]
  return id === undefined ? undefined : findTerm(session, id)
}

export function isRoundOver(session: LearnSession): boolean {
  return session.queue.length === 0
}

export function isSessionOver(session: LearnSession): boolean {
  return session.terms.every((entry) => entry.level === DONE_LEVEL)
}

/** The next up to ROUND_SIZE terms not done yet, in study order. */
export function startRound(session: LearnSession): LearnSession {
  const queue = session.terms
    .filter((entry) => entry.level < DONE_LEVEL)
    .slice(0, ROUND_SIZE)
    .map((entry) => entry.term.id)
  return { ...session, round: session.round + 1, queue }
}

export interface AppliedAnswer {
  session: LearnSession
  /** Whether to ask the repository for one more Leitner box (it allows one step a day). */
  promote: boolean
}

/**
 * Applies the final result of the current question: after "I was right", `correct` is true and
 * the session goes on as if the answer had been right all along.
 * Correct: one level up and off this round's queue. Wrong: back to level 0, marked as missed,
 * and asked again after 2-3 other questions (at the end when fewer are left).
 */
export function applyAnswer(
  session: LearnSession,
  correct: boolean,
  random: Random,
): AppliedAnswer {
  const current = currentTerm(session)
  if (current === undefined) throw new Error('No question to answer: the round is over')
  const updated: SessionTerm = correct
    ? { ...current, level: Math.min(current.level + 1, DONE_LEVEL) as Level }
    : { ...current, level: 0, missed: true }
  const rest = session.queue.slice(1)
  const queue = correct
    ? rest
    : insertAt(rest, randomInt(random, RETRY_GAP_MIN, RETRY_GAP_MAX), current.term.id)
  return {
    session: {
      ...session,
      terms: session.terms.map((entry) => (entry.term.id === current.term.id ? updated : entry)),
      queue,
      answers: [...session.answers, { termId: current.term.id, correct, round: session.round }],
    },
    promote: correct && updated.level === DONE_LEVEL && !updated.missed,
  }
}

/** For the progress bar: terms at level 2 out of all. */
export function doneCount(session: LearnSession): number {
  return session.terms.filter((entry) => entry.level === DONE_LEVEL).length
}

function findTerm(session: LearnSession, id: string): SessionTerm | undefined {
  return session.terms.find((entry) => entry.term.id === id)
}

function insertAt<T>(items: readonly T[], index: number, item: T): T[] {
  const at = Math.min(index, items.length)
  return [...items.slice(0, at), item, ...items.slice(at)]
}
