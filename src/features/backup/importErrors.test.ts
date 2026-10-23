import { describe, expect, it } from 'vitest'
import { ConnectionError, ValidationError } from '../../domain/errors.ts'
import { importProblems, MAX_SHOWN_PROBLEMS } from './importErrors.ts'

describe('importProblems', () => {
  it('lists each problem with its path, the file-level ones without', () => {
    const error = new ValidationError({
      _: ['This file is not a JSON backup'],
      'terms.3.word': ['Too long', 'Required'],
    })
    expect(importProblems(error)).toStrictEqual({
      shown: ['This file is not a JSON backup', 'terms.3.word: Too long', 'terms.3.word: Required'],
      hidden: 0,
    })
  })

  it('shows only the first few and counts the rest', () => {
    const fieldErrors = Object.fromEntries(
      Array.from({ length: MAX_SHOWN_PROBLEMS + 2 }, (_, i) => [`terms.${i}`, ['Unknown file']]),
    )
    const { shown, hidden } = importProblems(new ValidationError(fieldErrors))
    expect(shown).toHaveLength(MAX_SHOWN_PROBLEMS)
    expect(shown[0]).toBe('terms.0: Unknown file')
    expect(hidden).toBe(2)
  })

  it('shows any other error as one message', () => {
    expect(importProblems(new ConnectionError())).toStrictEqual({
      shown: [new ConnectionError().message],
      hidden: 0,
    })
  })
})
