import { useCallback } from 'react'
import { Link, useParams } from 'react-router'
import { masteredPercent } from '../../domain/mastery.ts'
import type { VocabFile } from '../../domain/schemas.ts'
import { deleteFileMessage, plural } from '../../shared/deleteMessages.ts'
import { NamedItemRow } from '../../shared/NamedItemRow.tsx'
import { NameForm } from '../../shared/NameForm.tsx'
import { ActionError, LoadError, Loading, NotFound } from '../../shared/PageStatus.tsx'
import { useRepository } from '../../shared/repositoryContext.ts'
import { useAsync } from '../../shared/useAsync.ts'
import { usePageWrites } from '../../shared/usePageWrites.ts'

export function FolderPage() {
  const { folderId = '' } = useParams()
  const repository = useRepository()
  const load = useCallback(() => repository.getFolderContents(folderId), [repository, folderId])
  const [state, reload] = useAsync(load)
  const { write, run, actionError } = usePageWrites(reload)

  function handleDelete(file: VocabFile) {
    void run(async () => {
      // Counted fresh, not from the list, so the message matches what will really be deleted.
      const contents = await repository.getFolderContents(folderId)
      const termCount = contents?.files.find((f) => f.id === file.id)?.termCount ?? 0
      if (!window.confirm(deleteFileMessage(file.name, termCount))) return
      await write(() => repository.deleteFile(file.id))
    })
  }

  if (state.status === 'loading') return <Loading />
  if (state.status === 'error') return <LoadError error={state.error} />
  if (!state.data) return <NotFound message="This folder no longer exists." />
  const { folder, files } = state.data

  return (
    <section>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Folders</Link>
      </nav>
      <h1>{folder.name}</h1>
      <NameForm
        label="New file"
        submitLabel="Create"
        onSubmit={(name) => write(() => repository.createFile(folder.id, { name }))}
      />
      <ActionError message={actionError} />
      {files.length === 0 ? (
        <p className="muted">No files yet. Create one, then add terms to it.</p>
      ) : (
        <ul className="item-list" aria-label="Files">
          {files.map((file) => {
            const { termCount, masteredCount } = file
            return (
              <NamedItemRow
                key={file.id}
                kind="file"
                name={file.name}
                to={`/files/${file.id}`}
                detail={`${plural(termCount, 'term')} · ${masteredPercent(masteredCount, termCount)}% mastered`}
                onRename={(name) => write(() => repository.renameFile(file.id, { name }))}
                onDelete={() => handleDelete(file)}
              />
            )
          })}
        </ul>
      )}
    </section>
  )
}
