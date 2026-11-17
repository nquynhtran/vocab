import { describe, expect, it } from 'vitest'
import { isLearnable } from './learnable.ts'

describe('isLearnable (#90)', () => {
  it('learns words and never collocations', () => {
    expect(isLearnable({ kind: 'word' })).toBe(true)
    expect(isLearnable({ kind: 'collocation' })).toBe(false)
  })
})
