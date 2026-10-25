import { describe, expect, it } from 'vitest'
import { gradeWritten, levenshtein, normalizeAnswer } from './grading.ts'

describe('normalizeAnswer', () => {
  it('uses toKey and drops punctuation at both ends only', () => {
    expect(normalizeAnswer('  Don’t   GIVE up! ')).toBe("don't give up")
    expect(normalizeAnswer('"well-known."')).toBe('well-known')
  })
})

describe('gradeWritten', () => {
  it('accepts the word whatever the case, spacing, quotes and edge punctuation', () => {
    expect(gradeWritten(' Give  UP. ', 'give up')).toBe('correct')
    expect(gradeWritten('don’t', "don't")).toBe('correct')
  })

  it('accepts NFD input typed on a Mac or an iPhone', () => {
    expect(gradeWritten('café'.normalize('NFD'), 'café')).toBe('correct')
  })

  it('calls one typo in a word of 5+ characters almost right', () => {
    expect(gradeWritten('aple', 'apple')).toBe('almost')
    expect(gradeWritten('applle', 'apple')).toBe('almost')
    expect(gradeWritten('appke', 'apple')).toBe('almost')
  })

  it('calls one typo in a shorter word wrong', () => {
    expect(gradeWritten('rum', 'run')).toBe('wrong')
    expect(gradeWritten('fish', 'wish')).toBe('wrong')
  })

  it('calls two typos wrong', () => {
    expect(gradeWritten('appel', 'apple')).toBe('wrong')
  })

  it('grades a word made only of punctuation on its punctuation', () => {
    expect(gradeWritten('?', '?')).toBe('correct')
    expect(gradeWritten('', '?')).toBe('wrong')
    expect(gradeWritten('!', '?')).toBe('wrong')
  })

  it('calls an empty answer wrong, even for a short word', () => {
    expect(gradeWritten('   ', 'a')).toBe('wrong')
    expect(gradeWritten('.', 'a')).toBe('wrong')
  })

  it('keeps Vietnamese-like accents meaningful', () => {
    expect(gradeWritten('cafe', 'café')).toBe('wrong')
    expect(gradeWritten('naive', 'naïve')).toBe('almost')
  })
})

describe('levenshtein', () => {
  it('counts insertions, deletions and substitutions', () => {
    expect(levenshtein('', '')).toBe(0)
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('kitten', 'sitting')).toBe(3)
  })

  it('counts an emoji or a precomposed letter as one character', () => {
    expect(levenshtein('a😀', 'a')).toBe(1)
    expect(levenshtein('é', 'e')).toBe(1)
  })
})
