import { describe, expect, it } from 'vitest'
import { randomInt, shuffled } from './random.ts'

describe('randomInt', () => {
  it('covers both ends', () => {
    expect(randomInt(() => 0, 2, 3)).toBe(2)
    expect(randomInt(() => 0.999999, 2, 3)).toBe(3)
  })
})

describe('shuffled', () => {
  it('returns a permutation and leaves the input as is', () => {
    const items = [1, 2, 3, 4, 5]
    const result = shuffled(items, Math.random)
    expect([...result].sort()).toEqual(items)
    expect(items).toEqual([1, 2, 3, 4, 5])
  })

  it('is fixed by the random passed in', () => {
    expect(shuffled([1, 2, 3], () => 0)).toEqual([2, 3, 1])
    expect(shuffled([1, 2, 3], () => 0.999999)).toEqual([1, 2, 3])
  })
})
