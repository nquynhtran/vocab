import { useCallback } from 'react'
import type { Folder } from '../../domain/schemas.ts'
import { deleteFolderMessage } from '../../shared/deleteMessages.ts'
import { NamedItemRow } from '../../shared/NamedItemRow.tsx'
import { NameForm } from '../../shared/NameForm.tsx'
import { ActionError, LoadError, Loading } from '../../shared/PageStatus.tsx'
import { useRepository } from '../../shared/repositoryContext.ts'
import { useAsync } from '../../shared/useAsync.ts'
import { usePageWrites } from '../../shared/usePageWrites.ts'

export function HomePage() {
  const repository = useRepository()
  const load = useCallback(() => repository.listFolders(), [repository])
  const [state, reload] = useAsync(load)
  const { write, run, actionError } = usePageWrites(reload)

  function handleDelete(folder: Folder) {
    void run(async () => {
      // Counted fresh, not from the list, so the message matches what will really be deleted.
      const stats = await repository.listFileStats(folder.id)
      const termCount = stats.reduce((sum, file) => sum + file.termCount, 0)
      if (!window.confirm(deleteFolderMessage(folder.name, stats.length, termCount))) return
      await write(() => repository.deleteFolder(folder.id))
    })
  }

  return (
    <section>
      <h1>Your folders</h1>
      <NameForm
        label="New folder"
        submitLabel="Create"
        onSubmit={(name) => write(() => repository.createFolder({ name }))}
      />
      <ActionError message={actionError} />
      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <LoadError error={state.error} />}
      {state.status === 'ready' &&
        (state.data.length === 0 ? (
          <p className="muted">No folders yet. Create one to start adding terms.</p>
        ) : (
          <ul className="item-list" aria-label="Folders">
            {state.data.map((folder) => (
              <NamedItemRow
                key={folder.id}
                kind="folder"
                name={folder.name}
                to={`/folders/${folder.id}`}
                onRename={(name) => write(() => repository.renameFolder(folder.id, { name }))}
                onDelete={() => handleDelete(folder)}
              />
            ))}
          </ul>
        ))}
    </section>
  )
}
