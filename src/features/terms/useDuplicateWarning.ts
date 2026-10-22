import { useEffect, useState } from 'react'
import type { TermLocation } from '../../data/repository.ts'
import { toKey } from '../../domain/text.ts'
import { useRepository } from '../../shared/repositoryContext.ts'

export const DUPLICATE_CHECK_DELAY_MS = 300

/**
 * Where else `word` already exists, checked while typing (decision #27). Waits for a pause so
 * every keystroke does not hit the database, and only shows a result for the word currently
 * typed and fetched after it was typed, so a late or outdated answer is never shown.
 */
export function useDuplicateWarning(word: string, excludeTermId?: string): TermLocation[] {
  const repository = useRepository()
  const [result, setResult] = useState<{ key: string; locations: TermLocation[] }>()
  const key = toKey(word)

  useEffect(() => {
    if (!key) return
    let current = true
    const timer = setTimeout(() => {
      repository.findTermsByWord(key, excludeTermId).then(
        (locations) => current && setResult({ key, locations }),
        // A warning is a hint only; failing to compute it must not block adding the term.
        (error: unknown) => console.error(error),
      )
    }, DUPLICATE_CHECK_DELAY_MS)
    return () => {
      current = false
      clearTimeout(timer)
      // Terms may have been added since this lookup (e.g. the one just submitted), so a
      // result is never reused when the same word is typed again.
      setResult(undefined)
    }
  }, [repository, key, excludeTermId])

  return key && result?.key === key ? result.locations : []
}

/** "IELTS / Unit 1, TOEIC / Unit 3": each file once, even if the word is there twice. */
export function formatLocations(locations: readonly TermLocation[]): string {
  const byFile = new Map(locations.map((location) => [location.fileId, location]))
  return [...byFile.values()]
    .map((location) => `${location.folderName} / ${location.fileName}`)
    .join(', ')
}
