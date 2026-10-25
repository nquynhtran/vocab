import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router'
import { LoadError, Loading, NotFound } from '../../shared/PageStatus.tsx'
import { useRepository } from '../../shared/repositoryContext.ts'
import { useAsync } from '../../shared/useAsync.ts'
import { LearnSession } from './LearnSession.tsx'

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
  return <LearnSession data={data} onStudyAgain={onStudyAgain} />
}
