import { useCallback, useEffect, useState } from 'react'
import type { LearnData } from '../../data/repository.ts'
import { ConnectionError } from '../../domain/errors.ts'
import type { Question } from '../../domain/learn/question.ts'
import { toSaved } from '../../domain/learn/resume.ts'
import { isSessionOver, progressCounts, type LearnSession } from '../../domain/learn/session.ts'
import { errorMessage } from '../../shared/errorMessage.ts'
import { PartOfSpeechLabel } from '../../shared/PartOfSpeechLabel.tsx'
import { useRepository } from '../../shared/repositoryContext.ts'
import { ChoiceQuestion } from './ChoiceQuestion.tsx'
import { Feedback } from './Feedback.tsx'
import {
  continueOn,
  finishPause,
  nextRound,
  overrule,
  pickChoice,
  resumeLearn,
  retry,
  saveFailed,
  saveSucceeded,
  startLearn,
  stop,
  submitWritten,
  type LearnState,
  type Step,
} from './learnFlow.ts'
import { clearSavedSession, writeSavedSession } from './sessionStore.ts'
import { RoundSummary, SessionSummary } from './Summaries.tsx'
import { WrittenQuestion } from './WrittenQuestion.tsx'

/** How long a right multiple choice answer stays on screen (docs/learn-algorithm.md). */
export const CORRECT_PAUSE_MS = 800

export function LearnSession({
  data,
  resumed,
  onReload,
}: {
  data: LearnData
  /** A session saved on this device, to go on with (#58). */
  resumed?: LearnSession
  onReload: () => void
}) {
  const repository = useRepository()
  const [state, setState] = useState(() =>
    resumed ? resumeLearn(data, resumed, Math.random) : startLearn(data, new Date(), Math.random),
  )
  const { session, step } = state
  const fileId = data.file.id

  // The one place that keeps the saved copy in step (docs/learn-algorithm.md#học-tiếp-sau-khi-dừng-58).
  // The session only changes once an answer is stored, or at a new round, so the copy never runs
  // ahead of the database. The session as opened is never written: a new one has no answer yet,
  // and a resumed one is already saved, with `savedAt` still the time of its last answer.
  const [opened] = useState(session)
  useEffect(() => {
    if (isSessionOver(session)) clearSavedSession(fileId)
    else if (session !== opened) writeSavedSession(fileId, toSaved(session, new Date()))
  }, [fileId, opened, session])

  // Saving follows the step, so Retry is just "back to saving" with the same record. Under
  // StrictMode the effect runs twice and sends the record twice: the repository keeps one (#51).
  useEffect(() => {
    if (step.kind !== 'saving') return
    const { save } = step
    let current = true
    repository.recordAnswer(save.record).then(
      () => current && setState((latest) => saveSucceeded(latest, save)),
      (error: unknown) => current && setState((latest) => saveFailed(latest, save, error)),
    )
    return () => {
      current = false
    }
  }, [repository, step])

  useEffect(() => {
    if (step.kind !== 'correct') return
    const timer = setTimeout(() => setState(finishPause), CORRECT_PAUSE_MS)
    return () => clearTimeout(timer)
  }, [step])

  // Every change goes through an updater that checks the current step, so a late second click
  // (or key press) changes nothing. Some updaters draw random numbers and read the clock, so
  // StrictMode's second call in development computes another outcome; React keeps one, and the
  // save effect sends the record of the one kept, so stored data always matches the screen.
  const update = setState
  const onPick = useCallback(
    (choice: string) => update((latest) => pickChoice(latest, choice, new Date(), Math.random)),
    [update],
  )

  const total = session.terms.length
  const { learned, familiar } = progressCounts(session)
  return (
    <section className="learn">
      <div className="learn__bar">
        <h1 className="learn__title">{data.file.name}</h1>
        {step.kind === 'question' && (
          <button type="button" className="button" onClick={() => update(stop)}>
            Stop
          </button>
        )}
      </div>
      <div className="learn__progress">
        {/*
          Two colours, which <progress> cannot draw. SVG widths are attributes, so the strict
          style-src of the CSP never comes into it. The text says the same for screen readers.
        */}
        <svg className="learn__meter" aria-hidden="true" focusable="false">
          <rect
            className="learn__meter-familiar"
            width={percent(learned + familiar, total)}
            height="100%"
          />
          <rect className="learn__meter-learned" width={percent(learned, total)} height="100%" />
        </svg>
        <span>
          {learned} learned · {familiar} familiar / {total}
        </span>
      </div>
      {/* A new key per answer resets the written box, also when the same term comes right back. */}
      <div key={`${session.round}-${session.answers.length}`} className="learn__body">
        <StepView
          step={step}
          session={session}
          onPick={onPick}
          update={update}
          onReload={onReload}
          fileId={data.file.id}
        />
      </div>
    </section>
  )
}

function StepView({
  step,
  session,
  onPick,
  update,
  onReload,
  fileId,
}: {
  step: Step
  session: LearnSession
  onPick: (choice: string) => void
  update: (change: (latest: LearnState) => LearnState) => void
  onReload: () => void
  fileId: string
}) {
  switch (step.kind) {
    case 'question':
      return (
        <>
          <Prompt question={step.question} />
          {step.question.kind === 'choice' ? (
            <ChoiceQuestion question={step.question} onPick={onPick} />
          ) : (
            <WrittenQuestion onSubmit={(text) => update((latest) => submitWritten(latest, text))} />
          )}
        </>
      )
    case 'roundOver':
      return (
        <RoundSummary
          session={session}
          onNextRound={() => update((latest) => nextRound(latest, Math.random))}
        />
      )
    case 'sessionOver':
      return (
        <SessionSummary
          session={session}
          fileId={fileId}
          onReload={onReload}
          onStartOver={() => {
            clearSavedSession(fileId)
            onReload()
          }}
        />
      )
    default: {
      const { answered } = step
      const { question } = answered
      const showFeedback =
        step.kind === 'feedback' || (step.kind === 'saving' && question.kind === 'written')
      return (
        <>
          <Prompt question={question} />
          {question.kind === 'choice' && (
            <ChoiceQuestion question={question} picked={answered.given} />
          )}
          {step.kind === 'saving' && question.kind === 'choice' && (
            <p className="muted" role="status">
              Saving…
            </p>
          )}
          {step.kind === 'correct' && (
            <p className="feedback__verdict feedback--right" role="status">
              Correct!
            </p>
          )}
          {showFeedback && (
            <Feedback
              answered={answered}
              busy={step.kind === 'saving'}
              onContinue={() => update((latest) => continueOn(latest, new Date(), Math.random))}
              onOverrule={() => update(overrule)}
            />
          )}
          {step.kind === 'saveFailed' && (
            <SaveError
              error={step.error}
              onRetry={() => update(retry)}
              onStop={() => update(stop)}
            />
          )}
        </>
      )
    }
  }
}

function Prompt({ question }: { question: Question }) {
  return (
    <div className="learn__prompt">
      <p className="muted">Meaning</p>
      <h2 className="learn__meaning">
        {question.meaning}
        {question.partOfSpeech && (
          <>
            {' '}
            <PartOfSpeechLabel partOfSpeech={question.partOfSpeech} />
          </>
        )}
      </h2>
      {question.example !== undefined && <p className="learn__example">{question.example}</p>}
    </div>
  )
}

/** Learning goes no further until the answer is stored: offline, nothing would be (#51). */
function SaveError({
  error,
  onRetry,
  onStop,
}: {
  error: unknown
  onRetry: () => void
  onStop: () => void
}) {
  // The generic ConnectionError text says to reload, which here would lose the session.
  const detail =
    error instanceof ConnectionError ? 'Check your connection, then retry.' : errorMessage(error)
  return (
    <div className="save-error" role="alert">
      <p>Your answer could not be saved. {detail}</p>
      <div className="feedback__actions">
        <button type="button" className="button button--primary" onClick={onRetry} autoFocus>
          Retry
        </button>
        <button type="button" className="button" onClick={onStop}>
          Stop
        </button>
      </div>
    </div>
  )
}

function percent(part: number, whole: number): string {
  return `${(part / whole) * 100}%`
}
