import { useCallback } from 'react'
import { Link } from 'react-router'
import type { Folder } from '../../domain/schemas.ts'
import { StreakPanel } from '../streak/StreakPanel.tsx'
import { useStreak } from '../streak/useStreak.ts'
import { deleteFolderMessage } from '../../shared/deleteMessages.ts'
import { NamedItemRow } from '../../shared/NamedItemRow.tsx'
import { ListHeader } from '../../shared/ListHeader.tsx'
import { ActionError, LoadError, Loading, RefreshError } from '../../shared/PageStatus.tsx'
import { useRepository } from '../../shared/repositoryContext.ts'
import { useAsync } from '../../shared/useAsync.ts'
import { usePageWrites } from '../../shared/usePageWrites.ts'

export function HomePage() {
  const repository = useRepository()
  const load = useCallback(() => repository.listFolders(), [repository])
  const [state, reload] = useAsync(load)
  const { write, run, actionError } = usePageWrites(reload)
  // Loaded apart from the folders: a study day that cannot be read must not cost the whole page
  // (decision #73). None of the writes here changes it.
  const streak = useStreak()

  function handleDelete(folder: Folder) {
    void run(async () => {
      // Counted fresh, not from the list, so the message matches what will really be deleted.
      const files = (await repository.getFolderContents(folder.id))?.files ?? []
      const termCount = files.reduce((sum, file) => sum + file.termCount, 0)
      if (!window.confirm(deleteFolderMessage(folder.name, files.length, termCount))) return
      await write(() => repository.deleteFolder(folder.id))
    })
  }

  return (
    <section>
      <StreakPanel state={streak} />
      <ListHeader
        title="Your folders"
        createLabel="New folder"
        onCreate={(name) => write(() => repository.createFolder({ name }))}
        empty={
          state.status === 'ready' && state.data.length === 0
            ? {
                icon: 'folder',
                title: 'No folders yet',
                text: 'Folders group your files, for example by course or topic.',
                actionLabel: 'Create your first folder',
                extra: (
                  <Link to="/settings" className="button button--ghost">
                    Restore a backup
                  </Link>
                ),
              }
            : undefined
        }
      />
      <ActionError message={actionError} />
      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <LoadError error={state.error} onRetry={reload} />}
      {state.status === 'ready' && <RefreshError error={state.refreshError} />}
      {state.status === 'ready' && state.data.length > 0 && (
        <ul className="item-grid" aria-label="Folders">
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
      )}
    </section>
  )
}
