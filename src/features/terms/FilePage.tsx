import { useCallback } from 'react'
import { Link, useParams } from 'react-router'
import type { Term } from '../../domain/schemas.ts'
import { deleteTermMessage, plural } from '../../shared/deleteMessages.ts'
import { ActionError, LoadError, Loading, NotFound } from '../../shared/PageStatus.tsx'
import { useRepository } from '../../shared/repositoryContext.ts'
import { useAsync } from '../../shared/useAsync.ts'
import { usePageWrites } from '../../shared/usePageWrites.ts'
import { TermForm } from './TermForm.tsx'
import { TermRow } from './TermRow.tsx'

export function FilePage() {
  const { fileId = '' } = useParams()
  const repository = useRepository()
  const load = useCallback(async () => {
    const file = await repository.getFile(fileId)
    if (!file) return undefined
    const [folder, terms] = await Promise.all([
      repository.getFolder(file.folderId),
      repository.listTerms(fileId),
    ])
    return folder && { file, folder, terms }
  }, [repository, fileId])
  const [state, reload] = useAsync(load)
  const { write, run, actionError } = usePageWrites(reload)

  function handleDelete(term: Term) {
    if (!window.confirm(deleteTermMessage(term.word))) return
    void run(() => write(() => repository.deleteTerm(term.id)))
  }

  if (state.status === 'loading') return <Loading />
  if (state.status === 'error') return <LoadError error={state.error} />
  if (!state.data) return <NotFound message="This file no longer exists." />
  const { file, folder, terms } = state.data

  return (
    <section>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span aria-hidden="true"> / </span>
        <Link to={`/folders/${folder.id}`}>{folder.name}</Link>
      </nav>
      <h1>{file.name}</h1>
      <p className="muted">{plural(terms.length, 'term')}</p>
      <TermForm
        submitLabel="Add"
        onSubmit={(input) => write(() => repository.createTerm(file.id, input))}
      />
      <ActionError message={actionError} />
      {terms.length > 0 && (
        <ul className="term-list" aria-label="Terms">
          <li className="term term--header" aria-hidden="true">
            <span>Term</span>
            <span>Meaning</span>
            <span>Example</span>
          </li>
          {terms.map((term) => (
            <TermRow
              key={term.id}
              term={term}
              onUpdate={(input) => write(() => repository.updateTerm(term.id, input))}
              onDelete={() => handleDelete(term)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
