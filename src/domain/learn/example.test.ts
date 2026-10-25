import { describe, expect, it } from 'vitest'
import { maskExample } from './example.ts'

describe('maskExample', () => {
  it('hides every occurrence, whatever the case', () => {
    expect(maskExample('Run! I run every day.', 'run')).toBe('____! I ____ every day.')
  })

  it('only matches whole words', () => {
    expect(maskExample('Start the art class.', 'art')).toBe('Start the ____ class.')
    expect(maskExample('Start the class.', 'art')).toBeUndefined()
  })

  it('hides nothing when only another form of the word appears, so no letters leak', () => {
    expect(maskExample('She is running late.', 'run')).toBeUndefined()
    expect(maskExample('I ran home.', 'run')).toBeUndefined()
  })

  it('does not treat an accented letter as a word boundary', () => {
    expect(maskExample('Un café noir.', 'caf')).toBeUndefined()
  })

  it('matches phrases and curly quotes', () => {
    expect(maskExample('Never give up on it.', 'give up')).toBe('Never ____ on it.')
    expect(maskExample('I don’t know.', "don't")).toBe('I ____ know.')
  })

  it('handles hyphens and slashes, which the `u` flag does not let be escaped freely', () => {
    expect(maskExample('A well-known fact.', 'well-known')).toBe('A ____ fact.')
    expect(maskExample('A famous fact.', 'well-known')).toBeUndefined()
    expect(maskExample('Use and/or here.', 'and/or')).toBe('Use ____ here.')
  })

  it('treats regex characters in the word literally', () => {
    expect(maskExample('Learn C++ now.', 'C++')).toBe('Learn ____ now.')
    expect(maskExample('Learn C now.', 'C++')).toBeUndefined()
  })

  it('has nothing to show without an example', () => {
    expect(maskExample(undefined, 'run')).toBeUndefined()
  })
})
