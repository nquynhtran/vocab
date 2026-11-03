import type { LookupResult, PronunciationLookup } from '../data/wiktionary.ts'

/** For tests that never press Look up: using it fails the test instead of reaching the network. */
export const unusedLookup: PronunciationLookup = {
  lookUp: () => Promise.reject(new Error('Look up was not expected in this test')),
}

/**
 * A lookup the test answers by hand: each call waits until `resolve` or `reject` is called, so
 * a test can type while a lookup is pending (stale results, docs/ui.md).
 */
export function manualLookup() {
  const calls: {
    word: string
    signal: AbortSignal | undefined
    resolve: (result: LookupResult) => void
    reject: (error: unknown) => void
  }[] = []
  const lookup: PronunciationLookup = {
    lookUp: (word, signal) =>
      new Promise((resolve, reject) => calls.push({ word, signal, resolve, reject })),
  }
  return { lookup, calls }
}
