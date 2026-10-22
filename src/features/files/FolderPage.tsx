import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router'
import { masteredPercent } from '../../domain/mastery.ts'
import type { VocabFile } from '../../domain/schemas.ts'
import { deleteFileMessage, plural } from '../../shared/deleteMessages.ts'
import { errorMessage } from '../../shared/errorMessage.ts'
import { NamedItemRow } from '../../shared/NamedItemRow.tsx'
import { NameForm } from '../../shared/NameForm.tsx'
import { LoadError, Loading, NotFound } from '../../shared/PageStatus.tsx'
import { useRepository } from '../../shared/repositoryContext.ts'
import { useAsync } from '../../shared/useAsync.ts'

export function FolderPage() {
  const { folderId = '' } = useParams()
  const repository = useRepository()
  const load = useCallback(async () => {
    const folder = await repository.getFolder(folderId)
    if (!folder) return undefined
    const [files, stats] = await Promise.all([
      repository.listFiles(folderId),
      repository.listFileStats(folderId),
    ])
    return { folder, files, stats: new Map(stats.map((s) => [s.fileId, s])) }
  }, [repository, folderId])
  const [state, reload] = useAsync(load)
  const [actionError, setActionError] = useState<string>()

  /**
   * Reloads after every write, failed ones too: if the folder/file was deleted in another tab,
   * the page then shows "no longer exists" instead of a form that keeps failing.
   */
  async function write(action: () => Promise<unknown>) {
    setActionError(undefined)
    try {
      await action()
    } finally {
      reload()
    }
  }

  async function handleDelete(file: VocabFile) {
    try {
      const stats = await repository.listFileStats(folderId)
      const termCount = stats.find((s) => s.fileId === file.id)?.termCount ?? 0
      if (!window.confirm(deleteFileMessage(file.name, termCount))) return
      await write(() => repository.deleteFile(file.id))
    } catch (error) {
      setActionError(errorMessage(error))
    }
  }

  if (state.status === 'loading') return <Loading />
  if (state.status === 'error') return <LoadError error={state.error} />
  if (!state.data) return <NotFound message="This folder no longer exists." />
  const { folder, files, stats } = state.data

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
      {actionError && (
        <p className="field-error" role="alert">
          {actionError}
        </p>
      )}
      {files.length === 0 ? (
        <p className="muted">No files yet. Create one, then add terms to it.</p>
      ) : (
        <ul className="item-list" aria-label="Files">
          {files.map((file) => {
            const { termCount = 0, masteredCount = 0 } = stats.get(file.id) ?? {}
            return (
              <NamedItemRow
                key={file.id}
                kind="file"
                name={file.name}
                to={`/files/${file.id}`}
                detail={`${plural(termCount, 'term')} · ${masteredPercent(masteredCount, termCount)}% mastered`}
                onRename={(name) => write(() => repository.renameFile(file.id, { name }))}
                onDelete={() => void handleDelete(file)}
              />
            )
          })}
        </ul>
      )}
    </section>
  )
}
