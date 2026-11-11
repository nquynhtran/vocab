import { useCallback } from 'react'
import { Link, useParams } from 'react-router'
import type { Term, TermInput, VocabFile } from '../../domain/schemas.ts'
import { deleteTermMessage, plural } from '../../shared/deleteMessages.ts'
import { Icon } from '../../shared/Icon.tsx'
import {
  ActionError,
  LoadError,
  Loading,
  NotFound,
  RefreshError,
} from '../../shared/PageStatus.tsx'
import { useRepository } from '../../shared/repositoryContext.ts'
import { useAsync } from '../../shared/useAsync.ts'
import { usePageWrites } from '../../shared/usePageWrites.ts'
import { useRevealedForm } from '../../shared/useRevealedForm.ts'
import { FileNotes } from './FileNotes.tsx'
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
  const [state, reload, retry] = useAsync(load)
  const { write, run, actionError } = usePageWrites(reload)

  function handleDelete(term: Term) {
    if (!window.confirm(deleteTermMessage(term.word))) return
    void run(() => write(() => repository.deleteTerm(term.id)))
  }

  if (state.status === 'loading') return <Loading />
  if (state.status === 'error') return <LoadError error={state.error} onRetry={retry} />
  if (!state.data) return <NotFound message="This file no longer exists." />
  const { file, folder, terms } = state.data

  return (
    <section>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span aria-hidden="true"> / </span>
        <Link to={`/folders/${folder.id}`}>{folder.name}</Link>
      </nav>
      <div className="file-header">
        <div className="file-header__title">
          <h1>{file.name}</h1>
          <p className="muted">{plural(terms.length, 'term')}</p>
        </div>
        {terms.length > 0 ? (
          <Link
            className="button button--primary file-header__learn"
            to={`/files/${file.id}/learn`}
          >
            Learn
          </Link>
        ) : (
          <p className="muted">Add some terms to start learning.</p>
        )}
      </div>
      <FileNotes
        key={file.id}
        file={file}
        loadLatest={() => repository.getFile(file.id)}
        onSave={async (notes) => {
          let saved: VocabFile | undefined
          await write(async () => {
            saved = await repository.updateFileNotes(file.id, { notes })
          })
          return saved!
        }}
      />
      <ActionError message={actionError} />
      <RefreshError error={state.refreshError} />
      <TermsSection
        key={`terms-${file.id}`}
        terms={terms}
        onAdd={(input) => write(() => repository.createTerm(file.id, input))}
        onUpdate={(term, input) => write(() => repository.updateTerm(term.id, input))}
        onDelete={handleDelete}
      />
    </section>
  )
}

interface TermsSectionProps {
  terms: Term[]
  onAdd: (input: TermInput) => Promise<void>
  onUpdate: (term: Term, input: TermInput) => Promise<void>
  onDelete: (term: Term) => void
}

/**
 * "+ Add term" opens the form, which then stays open so terms can be typed one after another. An
 * empty file has nothing else to do, so its form starts open (design.md, step 4).
 */
function TermsSection({ terms, onAdd, onUpdate, onDelete }: TermsSectionProps) {
  const { buttonRef, ...form } = useRevealedForm(terms.length === 0)

  return (
    <>
      <div className="list-header">
        <h2>Terms</h2>
        {!form.open && (
          <button
            ref={buttonRef}
            type="button"
            className="button list-header__create"
            onClick={form.show}
          >
            <Icon name="plus" />
            Add term
          </button>
        )}
      </div>
      {form.open && (
        <TermForm
          submitLabel="Add"
          autoFocus={form.autoFocus}
          onSubmit={onAdd}
          onCancel={form.hide}
        />
      )}
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
              onUpdate={(input) => onUpdate(term, input)}
              onDelete={() => onDelete(term)}
            />
          ))}
        </ul>
      )}
    </>
  )
}
