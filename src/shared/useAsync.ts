import { useCallback, useEffect, useState } from 'react'

export type AsyncState<T> =
  | { status: 'loading' }
  /** `refreshError`: a reload failed, so `data` is what the last successful load returned. */
  | { status: 'ready'; data: T; refreshError?: unknown }
  | { status: 'error'; error: unknown }

/**
 * Runs `load` (memoize it with useCallback) and again on `reload()`. The UI never subscribes to
 * the database (docs/architecture.md), so screens call `reload()` after each write.
 * A result that arrives after `load` changed is dropped, so a slow answer for the previous
 * page never overwrites the current one.
 * A failed reload keeps the page's data (with `refreshError`) instead of replacing the page:
 * after a write fails offline or with an expired session, the reload fails the same way, and
 * replacing the page would throw away what the user typed in its forms (decision #43).
 */
export function useAsync<T>(load: () => Promise<T>): [AsyncState<T>, () => void] {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })
  const [loadedFn, setLoadedFn] = useState(() => load)
  const [version, setVersion] = useState(0)

  // A different `load` means a different page: hide the old data instead of showing it under
  // the new title. Adjusting state during render is React's recommended pattern for this.
  if (loadedFn !== load) {
    setLoadedFn(() => load)
    setState({ status: 'loading' })
  }

  useEffect(() => {
    let current = true
    load().then(
      (data) => current && setState({ status: 'ready', data }),
      (error: unknown) =>
        current &&
        setState((previous) =>
          previous.status === 'ready'
            ? { status: 'ready', data: previous.data, refreshError: error }
            : { status: 'error', error },
        ),
    )
    return () => {
      current = false
    }
  }, [load, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return [state, reload]
}
