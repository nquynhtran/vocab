import { describe, expect, it } from 'vitest'
import { firstDifference } from './difference.ts'

describe('firstDifference', () => {
  it('returns undefined for equal values', () => {
    expect(firstDifference({ a: [1, { b: 'x' }] }, { a: [1, { b: 'x' }] })).toBeUndefined()
  })

  it('treats an absent field like an undefined one', () => {
    expect(firstDifference({ a: 1 }, { a: 1, b: undefined })).toBeUndefined()
    expect(firstDifference({ a: 1, b: undefined }, { a: 1 })).toBeUndefined()
  })

  it('names the path of the first changed value', () => {
    expect(firstDifference({ a: [{ b: ' x' }] }, { a: [{ b: 'x' }] })).toBe('a.0.b')
    expect(firstDifference({ a: 1, extra: 2 }, { a: 1 })).toBe('extra')
  })

  it('reports a change of shape at the containing path', () => {
    expect(firstDifference({ a: [1, 2] }, { a: [1] })).toBe('a')
    expect(firstDifference({ a: null }, { a: {} })).toBe('a')
    expect(firstDifference('x', 'y')).toBe('')
  })
})
