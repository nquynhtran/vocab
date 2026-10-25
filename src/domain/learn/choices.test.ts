import { describe, expect, it } from 'vitest'
import { CHOICE_COUNT, pickChoices, type ChoiceSource } from './choices.ts'
import type { Random } from './random.ts'

const term = (word: string, meaning = `nghĩa của ${word}`): ChoiceSource => ({ word, meaning })
/** No shuffling at all: options keep the order they were picked in. */
const lastFirst: Random = () => 0.999999
const sorted = (words: string[]) => [...words].sort()

describe('pickChoices', () => {
  const question = term('run', 'chạy')

  it('offers the word and three distractors from the same file', () => {
    const file = [question, term('walk'), term('swim'), term('jump'), term('fly')]
    const choices = pickChoices(question, file, [], Math.random)
    expect(choices).toHaveLength(CHOICE_COUNT)
    expect(choices).toContain('run')
    expect(new Set(choices).size).toBe(CHOICE_COUNT)
  })

  it('takes distractors from the file before the folder', () => {
    const file = [question, term('walk'), term('swim'), term('jump')]
    const folder = [term('cat'), term('dog')]
    expect(sorted(pickChoices(question, file, folder, Math.random))).toEqual(
      sorted(['run', 'walk', 'swim', 'jump']),
    )
  })

  it('fills up from the rest of the folder when the file has too few', () => {
    const file = [question, term('walk')]
    const folder = [term('cat'), term('dog')]
    expect(sorted(pickChoices(question, file, folder, Math.random))).toEqual(
      sorted(['run', 'walk', 'cat', 'dog']),
    )
  })

  it('counts usable distractors, not terms: a big file of one word still uses the folder', () => {
    const file = [
      question,
      term('run', 'điều hành'),
      term('Run', 'vận hành'),
      term('run ', 'một chuỗi'),
      term('walk'),
    ]
    const folder = [term('cat'), term('dog')]
    expect(sorted(pickChoices(question, file, folder, Math.random))).toEqual(
      sorted(['run', 'walk', 'cat', 'dog']),
    )
  })

  it('never offers another word with the same meaning, or the same word twice', () => {
    const file = [question, term('jog', 'Chạy '), term('walk'), term('walk', 'bước đi')]
    expect(sorted(pickChoices(question, file, [], Math.random))).toEqual(['run', 'walk'])
  })

  it('offers only the word itself when nothing else is usable', () => {
    expect(pickChoices(question, [question], [term('jog', 'chạy')], Math.random)).toEqual(['run'])
  })

  it('shuffles with the random passed in', () => {
    const file = [question, term('walk'), term('swim'), term('jump')]
    expect(pickChoices(question, file, [], lastFirst)).toEqual(['run', 'walk', 'swim', 'jump'])
  })
})
