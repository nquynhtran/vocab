import { createContext, useContext } from 'react'
import type { PronunciationLookup } from '../data/wiktionary.ts'

/**
 * The Look up button's dictionary, injected like RepositoryContext: `main.tsx` provides
 * Wiktionary, tests provide a fake so they never reach the network.
 */
export const PronunciationLookupContext = createContext<PronunciationLookup | null>(null)

export function usePronunciationLookup(): PronunciationLookup {
  const lookup = useContext(PronunciationLookupContext)
  if (!lookup) {
    throw new Error('usePronunciationLookup must be used inside <PronunciationLookupContext>')
  }
  return lookup
}
