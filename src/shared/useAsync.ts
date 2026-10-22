import { useCallback, useEffect, useState } from 'react'

export type AsyncState<T> =
  { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; error: unknown }

/**
 * Runs `load` (memoize it with useCallback) and again on `reload()`. The UI never subscribes to
 * the database (docs/architecture.md), so screens call `reload()` after each write.
 * A result that arrives after `load` changed is dropped, so a slow answer for the previous
 * page never overwrites the current one.
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
      (error: unknown) => current && setState({ status: 'error', error }),
    )
    return () => {
      current = false
    }
  }, [load, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return [state, reload]
}
