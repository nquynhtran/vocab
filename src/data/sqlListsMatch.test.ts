import { describe, expect, it } from 'vitest'
import { PARTS_OF_SPEECH, TERM_KINDS } from '../domain/schemas.ts'
import migration from '../../supabase/migrations/20261117120000_collocations_parts_of_speech.sql?raw'

// The lists are written twice on purpose: the database refuses values the app does not know,
// and a list changed on one side only must fail here, not at the first write (architecture drift).
/** The quoted values inside a SQL list, in order. */
function quotedValues(sqlList: string): string[] {
  return [...sqlList.matchAll(/'([^']*)'/g)].map((match) => match[1]!)
}

describe('lists written in SQL match the app (#90)', () => {
  it('parts of speech: the array in parts_of_speech_valid is PARTS_OF_SPEECH', () => {
    const list = /array\[([^\]]*)\]::text\[\]/.exec(migration)?.[1]
    expect(list).toBeDefined()
    expect(quotedValues(list!)).toEqual([...PARTS_OF_SPEECH])
  })

  it('kinds: the CHECK on terms.kind is TERM_KINDS', () => {
    const list = /kind in \(([^)]*)\)/.exec(migration)?.[1]
    expect(list).toBeDefined()
    expect(quotedValues(list!)).toEqual([...TERM_KINDS])
  })
})
