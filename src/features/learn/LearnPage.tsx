import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import type { LearnData } from '../../data/repository.ts'
import { resumeSession } from '../../domain/learn/resume.ts'
import { LoadError, Loading, NotFound } from '../../shared/PageStatus.tsx'
import { useRepository } from '../../shared/repositoryContext.ts'
import { useAsync } from '../../shared/useAsync.ts'
import { LearnFrame } from './LearnFrame.tsx'
import { LearnSession } from './LearnSession.tsx'
import { clearSavedSession, readSavedSession } from './sessionStore.ts'

export function LearnPage() {
  const { fileId = '' } = useParams()
  const [attempt, setAttempt] = useState(0)
  // "Study again", "Continue" and "Start over" mount a fresh loader: new data (progress changed),
  // and the stopped session if one is saved, else a new one.
  return (
    <LearnLoader
      key={`${fileId}-${attempt}`}
      fileId={fileId}
      onReload={() => setAttempt((count) => count + 1)}
    />
  )
}

function LearnLoader({ fileId, onReload }: { fileId: string; onReload: () => void }) {
  const repository = useRepository()
  const load = useCallback(() => repository.getLearnData(fileId), [repository, fileId])
  const [state] = useAsync(load)

  if (state.status === 'loading') {
    return (
      <LearnFrame fileId={fileId}>
        <Loading />
      </LearnFrame>
    )
  }
  if (state.status === 'error') {
    return (
      <LearnFrame fileId={fileId}>
        <LoadError error={state.error} />
      </LearnFrame>
    )
  }
  if (!state.data) {
    return (
      <LearnFrame fileId={fileId}>
        <NotFound message="This file no longer exists." />
      </LearnFrame>
    )
  }
  const { data } = state
  if (data.terms.length === 0) {
    return (
      <LearnFrame fileId={fileId} title={data.file.name}>
        <p>Add some terms to start learning.</p>
        <p>
          <Link to={`/files/${fileId}`}>Back to list</Link>
        </p>
      </LearnFrame>
    )
  }
  return <LearnStart data={data} onReload={onReload} />
}

/** Goes on with a session stopped halfway on this device, without asking (#58, #63). */
function LearnStart({ data, onReload }: { data: LearnData; onReload: () => void }) {
  const fileId = data.file.id
  const [resumed] = useState(() => {
    const saved = readSavedSession(fileId)
    if (saved === undefined) return undefined
    const progress = new Map(data.progress.map((entry) => [entry.termId, entry]))
    return resumeSession({ saved, terms: data.terms, progress })
  })
  // A copy with nothing to continue (every term learned or deleted since) must not come back
  // to life later, when a term is added.
  useEffect(() => {
    if (resumed === undefined) clearSavedSession(fileId)
  }, [fileId, resumed])

  return <LearnSession data={data} resumed={resumed} onReload={onReload} />
}
