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

  it('hides regular inflections whole, so the ending does not leak (#82)', () => {
    expect(maskExample('She decided to leave.', 'decide')).toBe('She ____ to leave.')
    expect(maskExample('Making tea is easy.', 'make')).toBe('____ tea is easy.')
    expect(maskExample('She studies; he studied.', 'study')).toBe('She ____; he ____.')
    expect(maskExample('It stopped, then kept stopping.', 'stop')).toBe('It ____, then kept ____.')
    expect(maskExample('He is lying.', 'lie')).toBe('He is ____.')
    expect(maskExample('Two boxes and three cats.', 'box')).toBe('Two ____ and three cats.')
    expect(maskExample('She is going home.', 'go')).toBe('She is ____ home.')
    expect(maskExample('He goes and watches.', 'watch')).toBe('He goes and ____.')
  })

  it('leaves an irregular form next to a hidden regular one: accepted, as with "run" and "ran"', () => {
    expect(maskExample('Making tea, he made a mess.', 'make')).toBe('____ tea, he made a mess.')
  })

  it('adds -es only to the endings that take it', () => {
    expect(maskExample('She cares a lot.', 'car')).toBeUndefined()
    expect(maskExample('She hates it.', 'hat')).toBeUndefined()
  })

  it('gives a two-letter word no -ed or doubling, and never doubles w, x or y', () => {
    expect(maskExample('They upped it.', 'up')).toBeUndefined()
    expect(maskExample('They uped it.', 'up')).toBeUndefined()
    expect(maskExample('Fixxed it.', 'fix')).toBeUndefined()
    expect(maskExample('Fixed it.', 'fix')).toBe('____ it.')
  })

  it('inflects the letter-only words of a phrase and keeps the others as typed', () => {
    expect(maskExample('Don’t giving up.', "don't give up")).toBe('____.')
    expect(maskExample('Do not give up.', "don't give up")).toBeUndefined()
  })

  it('inflects every word of a phrase', () => {
    expect(maskExample('I looked it up, then looked up.', 'look up')).toBe(
      'I looked it up, then ____.',
    )
    expect(maskExample('Two credit cards.', 'credit card')).toBe('Two ____.')
    expect(maskExample('They gave up smoking.', 'give up')).toBeUndefined()
  })

  it('still hides nothing for irregular forms or other words, so no letters leak', () => {
    expect(maskExample('I ran home.', 'run')).toBeUndefined()
    expect(maskExample('Go to bed.', 'be')).toBeUndefined()
    expect(maskExample('A runner ran.', 'run')).toBeUndefined()
    expect(maskExample('The artist left.', 'art')).toBeUndefined()
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

  it('keeps the case of the example in the unmasked text', () => {
    expect(maskExample('DECIDED! Yes.', 'decide')).toBe('____! Yes.')
  })

  it('has nothing to show without an example', () => {
    expect(maskExample(undefined, 'run')).toBeUndefined()
  })
})
