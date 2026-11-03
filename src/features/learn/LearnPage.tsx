import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import type { LearnData } from '../../data/repository.ts'
import { resumeSession } from '../../domain/learn/resume.ts'
import { progressCounts, type LearnSession as Session } from '../../domain/learn/session.ts'
import { LoadError, Loading, NotFound } from '../../shared/PageStatus.tsx'
import { useRepository } from '../../shared/repositoryContext.ts'
import { useAsync } from '../../shared/useAsync.ts'
import { lastStudied } from './lastStudied.ts'
import { LearnSession } from './LearnSession.tsx'
import { clearSavedSession, readSavedSession } from './sessionStore.ts'

export function LearnPage() {
  const { fileId = '' } = useParams()
  const [attempt, setAttempt] = useState(0)
  // "Study again" mounts a fresh loader: new data (progress changed) and a new session.
  return (
    <LearnLoader
      key={`${fileId}-${attempt}`}
      fileId={fileId}
      onStudyAgain={() => setAttempt((count) => count + 1)}
    />
  )
}

function LearnLoader({ fileId, onStudyAgain }: { fileId: string; onStudyAgain: () => void }) {
  const repository = useRepository()
  const load = useCallback(() => repository.getLearnData(fileId), [repository, fileId])
  const [state] = useAsync(load)

  if (state.status === 'loading') return <Loading />
  if (state.status === 'error') return <LoadError error={state.error} />
  if (!state.data) return <NotFound message="This file no longer exists." />
  const { data } = state
  if (data.terms.length === 0) {
    return (
      <section>
        <h1>{data.file.name}</h1>
        <p>Add some terms to start learning.</p>
        <p>
          <Link to={`/files/${fileId}`}>Back to list</Link>
        </p>
      </section>
    )
  }
  return <LearnStart data={data} onStudyAgain={onStudyAgain} />
}

interface Resumable {
  session: Session
  /** "5 days ago", fixed when the page opens. */
  lastStudied: string
}

/** Asks Continue / Start over first when a session was stopped halfway on this device (#58). */
function LearnStart({ data, onStudyAgain }: { data: LearnData; onStudyAgain: () => void }) {
  const fileId = data.file.id
  const [resumable] = useState((): Resumable | undefined => {
    const saved = readSavedSession(fileId)
    if (saved === undefined) return undefined
    const progress = new Map(data.progress.map((entry) => [entry.termId, entry]))
    const session = resumeSession({ saved, terms: data.terms, progress })
    return session && { session, lastStudied: lastStudied(saved.savedAt, new Date()) }
  })
  const [choice, setChoice] = useState<'continue' | 'startOver'>()
  // A copy with nothing to continue (every term learned or deleted since) must not come back
  // to life later, when a term is added.
  useEffect(() => {
    if (resumable === undefined) clearSavedSession(fileId)
  }, [fileId, resumable])

  if (resumable === undefined || choice === 'startOver') {
    return <LearnSession data={data} onStudyAgain={onStudyAgain} />
  }
  if (choice === 'continue') {
    return <LearnSession data={data} resumed={resumable.session} onStudyAgain={onStudyAgain} />
  }
  const { learned } = progressCounts(resumable.session)
  return (
    <section className="learn">
      <h1 className="learn__title">{data.file.name}</h1>
      <div className="summary">
        <h2>Continue where you left off?</h2>
        <p>
          {learned} / {resumable.session.terms.length} learned, last studied {resumable.lastStudied}
          .
        </p>
        <div className="summary__actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => setChoice('continue')}
            autoFocus
          >
            Continue
          </button>
          <button
            type="button"
            className="button"
            onClick={() => {
              clearSavedSession(fileId)
              setChoice('startOver')
            }}
          >
            Start over
          </button>
        </div>
      </div>
    </section>
  )
}
