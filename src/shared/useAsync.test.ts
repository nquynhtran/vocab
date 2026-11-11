import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useAsync } from './useAsync.ts'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

describe('useAsync', () => {
  it('loads, then reloads on demand', async () => {
    let calls = 0
    const load = () => Promise.resolve(++calls)
    const { result } = renderHook(() => useAsync(load))
    expect(result.current[0]).toEqual({ status: 'loading' })
    await waitFor(() => expect(result.current[0]).toEqual({ status: 'ready', data: 1 }))

    act(() => result.current[1]())
    await waitFor(() => expect(result.current[0]).toEqual({ status: 'ready', data: 2 }))
  })

  it('reports a failed load', async () => {
    const error = new Error('boom')
    const load = () => Promise.reject(error)
    const { result } = renderHook(() => useAsync(load))
    await waitFor(() => expect(result.current[0]).toEqual({ status: 'error', error }))
  })

  it('reload after a failed load keeps the error until the result; retry shows loading', async () => {
    const error = new Error('offline')
    const next = deferred<string>()
    let calls = 0
    const load = () => (++calls === 1 ? Promise.reject(error) : next.promise)
    const { result } = renderHook(() => useAsync(load))
    await waitFor(() => expect(result.current[0]).toEqual({ status: 'error', error }))

    // useStreak reloads on every window focus: an error must not flash "loading" each time.
    act(() => result.current[1]())
    expect(result.current[0]).toEqual({ status: 'error', error })

    act(() => result.current[2]())
    expect(result.current[0]).toEqual({ status: 'loading' })
    next.resolve('data')
    await waitFor(() => expect(result.current[0]).toEqual({ status: 'ready', data: 'data' }))
  })

  it('retry leaves loaded data on screen', async () => {
    const load = () => Promise.resolve('data')
    const { result } = renderHook(() => useAsync(load))
    await waitFor(() => expect(result.current[0]).toEqual({ status: 'ready', data: 'data' }))
    act(() => result.current[2]())
    expect(result.current[0]).toEqual({ status: 'ready', data: 'data' })
  })

  it('keeps the data when a reload fails, so the page and its forms stay', async () => {
    const error = new Error('offline')
    let fail = false
    const load = () => (fail ? Promise.reject(error) : Promise.resolve('data'))
    const { result } = renderHook(() => useAsync(load))
    await waitFor(() => expect(result.current[0]).toEqual({ status: 'ready', data: 'data' }))

    fail = true
    act(() => result.current[1]())
    await waitFor(() =>
      expect(result.current[0]).toEqual({ status: 'ready', data: 'data', refreshError: error }),
    )

    fail = false
    act(() => result.current[1]())
    await waitFor(() => expect(result.current[0]).toEqual({ status: 'ready', data: 'data' }))
  })

  it('hides the previous page and drops its late result when load changes', async () => {
    const slowA = deferred<string>()
    const loadA = () => slowA.promise
    const loadB = () => Promise.resolve('B')
    const { result, rerender } = renderHook(({ load }) => useAsync(load), {
      initialProps: { load: loadA },
    })

    rerender({ load: loadB })
    expect(result.current[0]).toEqual({ status: 'loading' })
    await waitFor(() => expect(result.current[0]).toEqual({ status: 'ready', data: 'B' }))

    await act(async () => slowA.resolve('A'))
    expect(result.current[0]).toEqual({ status: 'ready', data: 'B' })
  })
})
