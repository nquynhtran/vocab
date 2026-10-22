import { useCallback, useState } from 'react'
import { errorMessage } from './errorMessage.ts'

/**
 * How every page writes:
 * - `write` reloads after every write, failed ones too: if the folder/file was deleted in
 *   another tab, the page then shows "no longer exists" instead of a form that keeps failing.
 *   It rethrows, so a form can show the error next to its field.
 * - `run` is for actions without a form (delete): its error is kept in `actionError` and shown
 *   above the list instead.
 */
export function usePageWrites(reload: () => void) {
  const [actionError, setActionError] = useState<string>()

  const write = useCallback(
    async (action: () => Promise<unknown>) => {
      setActionError(undefined)
      try {
        await action()
      } finally {
        reload()
      }
    },
    [reload],
  )

  const run = useCallback(async (action: () => Promise<void>) => {
    try {
      await action()
    } catch (error) {
      setActionError(errorMessage(error))
    }
  }, [])

  return { write, run, actionError }
}
