import { describe, expect, it } from 'vitest'
import { isMastered, MASTERED_BOX, masteredPercent } from './mastery.ts'

describe('isMastered', () => {
  it('starts at MASTERED_BOX', () => {
    expect(isMastered({ box: MASTERED_BOX - 1 })).toBe(false)
    expect(isMastered({ box: MASTERED_BOX })).toBe(true)
    expect(isMastered({ box: MASTERED_BOX + 2 })).toBe(true)
  })

  it('is false for a term never studied', () => {
    expect(isMastered(undefined)).toBe(false)
  })
})

describe('masteredPercent', () => {
  it('is 0 for an empty file', () => {
    expect(masteredPercent(0, 0)).toBe(0)
  })

  it('rounds down so 100% means every term', () => {
    expect(masteredPercent(199, 200)).toBe(99)
    expect(masteredPercent(200, 200)).toBe(100)
    expect(masteredPercent(1, 3)).toBe(33)
    expect(masteredPercent(2, 3)).toBe(66)
  })
})
