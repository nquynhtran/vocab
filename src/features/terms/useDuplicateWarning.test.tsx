import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repository, TermLocation } from '../../data/repository.ts'
import { RepositoryContext } from '../../shared/repositoryContext.ts'
import {
  DUPLICATE_CHECK_DELAY_MS,
  formatLocations,
  useDuplicateWarning,
} from './useDuplicateWarning.ts'

function location(fileId: string, fileName: string): TermLocation {
  return { termId: `t-${fileId}`, fileId, folderName: 'IELTS', fileName }
}

/** Only `findTermsByWord` is used; each call returns a promise the test resolves by hand. */
function setup() {
  const pending: { word: string; resolve: (l: TermLocation[]) => void }[] = []
  const findTermsByWord = vi.fn(
    (word: string) => new Promise<TermLocation[]>((resolve) => pending.push({ word, resolve })),
  )
  const repository = { findTermsByWord } as unknown as Repository
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RepositoryContext value={repository}>{children}</RepositoryContext>
  )
  const hook = renderHook(({ word }) => useDuplicateWarning(word), {
    wrapper,
    initialProps: { word: '' },
  })
  return { ...hook, findTermsByWord, pending }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useDuplicateWarning', () => {
  it('looks up once after typing pauses', async () => {
    const { rerender, result, findTermsByWord, pending } = setup()
    for (const word of ['r', 'ru', 'run']) {
      rerender({ word })
      act(() => vi.advanceTimersByTime(DUPLICATE_CHECK_DELAY_MS - 1))
    }
    expect(findTermsByWord).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(findTermsByWord).toHaveBeenCalledExactlyOnceWith('run', undefined)
    await act(async () => pending[0]?.resolve([location('f1', 'Unit 1')]))
    expect(result.current).toEqual([location('f1', 'Unit 1')])
  })

  it('never shows a late answer for a word no longer typed', async () => {
    const { rerender, result, pending } = setup()
    rerender({ word: 'run' })
    act(() => vi.advanceTimersByTime(DUPLICATE_CHECK_DELAY_MS))
    rerender({ word: 'walk' })

    await act(async () => pending[0]?.resolve([location('f1', 'Unit 1')]))
    expect(result.current).toEqual([])
  })

  it('does not reuse an old answer when the same word is typed again', async () => {
    const { rerender, result, pending } = setup()
    rerender({ word: 'run' })
    act(() => vi.advanceTimersByTime(DUPLICATE_CHECK_DELAY_MS))
    await act(async () => pending[0]?.resolve([location('f1', 'Unit 1')]))
    rerender({ word: '' })
    rerender({ word: 'run' })

    expect(result.current).toEqual([])
  })

  it('does not look up a blank word', () => {
    const { rerender, findTermsByWord } = setup()
    rerender({ word: '   ' })
    act(() => vi.advanceTimersByTime(DUPLICATE_CHECK_DELAY_MS * 2))
    expect(findTermsByWord).not.toHaveBeenCalled()
  })
})

describe('formatLocations', () => {
  it('lists each file once', () => {
    expect(
      formatLocations([
        location('f1', 'Unit 1'),
        location('f1', 'Unit 1'),
        location('f2', 'Unit 2'),
      ]),
    ).toBe('IELTS / Unit 1, IELTS / Unit 2')
  })
})
