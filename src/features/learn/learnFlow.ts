import type { LearnData } from '../../data/repository.ts'
import { localDay } from '../../domain/day.ts'
import { toAnswerRecord, type AnswerRecord } from '../../domain/learn/answer.ts'
import type { ChoiceSource } from '../../domain/learn/choices.ts'
import { gradeWritten, type WrittenGrade } from '../../domain/learn/grading.ts'
import { buildQuestion, type Question } from '../../domain/learn/question.ts'
import type { Random } from '../../domain/learn/random.ts'
import {
  applyAnswer,
  currentTerm,
  isSessionOver,
  startRound,
  startSession,
  type LearnSession,
} from '../../domain/learn/session.ts'

/**
 * The Learn screen as pure steps (docs/ui.md, docs/learn-algorithm.md#ghi-kết-quả). Each
 * function returns a new state, or the same one when the action does not fit the current step,
 * so a second click that arrives late changes nothing.
 * Random numbers are drawn only here, from event handlers: where the session goes after an
 * answer is decided before it is saved, so a Retry sends the same record and the screen does not
 * change its mind about the next question.
 */
export interface LearnState {
  session: LearnSession
  sources: ChoiceSources
  step: Step
}

interface ChoiceSources {
  fileTerms: readonly ChoiceSource[]
  folderTerms: readonly ChoiceSource[]
}

/** `overridden`: "I was right" on a written answer graded wrong. */
export interface Answered {
  question: Question
  given: string
  grade: WrittenGrade
  overridden: boolean
}

/** One answer to store, and the session and step to show once it is stored. */
export interface PendingSave {
  record: AnswerRecord
  session: LearnSession
  then: Step
}

export type Step =
  | { kind: 'question'; question: Question }
  /**
   * After a wrong multiple choice answer (already saved, `next` set) or any written answer
   * (saved on Continue, so "I was right" needs no undo).
   */
  | { kind: 'feedback'; answered: Answered; next?: Step }
  | { kind: 'saving'; answered: Answered; save: PendingSave }
  | { kind: 'saveFailed'; answered: Answered; save: PendingSave; error: unknown }
  /** A right multiple choice answer, saved and shown for a moment before `next`. */
  | { kind: 'correct'; answered: Answered; next: Step }
  | { kind: 'roundOver' }
  /** Every term learned, or the learner stopped. */
  | { kind: 'sessionOver' }

export function startLearn(
  data: Pick<LearnData, 'terms' | 'progress' | 'distractors'>,
  now: Date,
  random: Random,
): LearnState {
  const session = startSession({
    terms: data.terms,
    progress: new Map(data.progress.map((entry) => [entry.termId, entry])),
    today: localDay(now),
    random,
  })
  const sources = { fileTerms: data.terms, folderTerms: data.distractors }
  return { session, sources, step: stepFor(session, sources, random) }
}

export function isCorrect(answered: Answered): boolean {
  return answered.grade !== 'wrong' || answered.overridden
}

/** Multiple choice is saved at once (#52); a wrong pick then shows feedback. */
export function pickChoice(
  state: LearnState,
  choice: string,
  now: Date,
  random: Random,
): LearnState {
  const { step } = state
  if (step.kind !== 'question' || step.question.kind !== 'choice') return state
  const correct = choice === step.question.word
  const answered: Answered = {
    question: step.question,
    given: choice,
    grade: correct ? 'correct' : 'wrong',
    overridden: false,
  }
  return {
    ...state,
    step: savingStep(state, answered, now, random, (next) =>
      correct ? { kind: 'correct', answered, next } : { kind: 'feedback', answered, next },
    ),
  }
}

export function submitWritten(state: LearnState, text: string): LearnState {
  const { step } = state
  if (step.kind !== 'question' || step.question.kind !== 'written') return state
  const answered: Answered = {
    question: step.question,
    given: text,
    grade: gradeWritten(text, step.question.word),
    overridden: false,
  }
  return { ...state, step: { kind: 'feedback', answered } }
}

/** "I was right": only before a written answer is saved, so nothing stored needs undoing. */
export function overrule(state: LearnState): LearnState {
  const { step } = state
  if (step.kind !== 'feedback' || step.next !== undefined || step.answered.grade !== 'wrong') {
    return state
  }
  return { ...state, step: { ...step, answered: { ...step.answered, overridden: true } } }
}

export function continueOn(state: LearnState, now: Date, random: Random): LearnState {
  const { step } = state
  if (step.kind !== 'feedback') return state
  if (step.next !== undefined) return { ...state, step: step.next }
  return { ...state, step: savingStep(state, step.answered, now, random, (next) => next) }
}

/** `save` is the one that was sent: the result of an earlier, abandoned save is ignored. */
export function saveSucceeded(state: LearnState, save: PendingSave): LearnState {
  const { step } = state
  if (step.kind !== 'saving' || step.save !== save) return state
  return { ...state, session: save.session, step: save.then }
}

export function saveFailed(state: LearnState, save: PendingSave, error: unknown): LearnState {
  const { step } = state
  if (step.kind !== 'saving' || step.save !== save) return state
  return { ...state, step: { kind: 'saveFailed', answered: step.answered, save, error } }
}

/** Sends exactly the same record again, which the repository stores at most once (#51). */
export function retry(state: LearnState): LearnState {
  const { step } = state
  if (step.kind !== 'saveFailed') return state
  return { ...state, step: { kind: 'saving', answered: step.answered, save: step.save } }
}

export function finishPause(state: LearnState): LearnState {
  const { step } = state
  return step.kind === 'correct' ? { ...state, step: step.next } : state
}

export function nextRound(state: LearnState, random: Random): LearnState {
  if (state.step.kind !== 'roundOver') return state
  const session = startRound(state.session)
  return { ...state, session, step: stepFor(session, state.sources, random) }
}

/**
 * From a question, or after a failed save (that answer may or may not be stored). Not while
 * saving: the result would arrive after the summary was shown.
 */
export function stop(state: LearnState): LearnState {
  const { kind } = state.step
  if (kind !== 'question' && kind !== 'saveFailed') return state
  return { ...state, step: { kind: 'sessionOver' } }
}

function savingStep(
  state: LearnState,
  answered: Answered,
  now: Date,
  random: Random,
  show: (next: Step) => Step,
): Step {
  const correct = isCorrect(answered)
  const { session, promote } = applyAnswer(state.session, correct, random)
  const record = toAnswerRecord(answered.question.termId, correct, promote, now)
  const then = show(stepFor(session, state.sources, random))
  return { kind: 'saving', answered, save: { record, session, then } }
}

function stepFor(session: LearnSession, sources: ChoiceSources, random: Random): Step {
  if (isSessionOver(session)) return { kind: 'sessionOver' }
  const current = currentTerm(session)
  if (current === undefined) return { kind: 'roundOver' }
  return {
    kind: 'question',
    question: buildQuestion(current, sources.fileTerms, sources.folderTerms, random),
  }
}
