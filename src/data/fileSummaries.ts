import { isMastered } from '../domain/mastery.ts'
import type { TermProgress, VocabFile } from '../domain/schemas.ts'
import { byName } from './ordering.ts'
import type { FileSummary } from './repository.ts'

/** One term of a folder, with only what the counts need; `box` is absent when never studied. */
export interface TermBox {
  fileId: string
  box?: TermProgress['box']
}

/**
 * The files of one folder with their counts, sorted as `getFolderContents` promises. Shared by
 * every repository so "term count" and "mastered" mean the same thing on every storage.
 */
export function summarizeFiles(
  files: readonly VocabFile[],
  terms: readonly TermBox[],
): FileSummary[] {
  const counts = new Map<string, { termCount: number; masteredCount: number }>()
  for (const { fileId, box } of terms) {
    const current = counts.get(fileId) ?? { termCount: 0, masteredCount: 0 }
    counts.set(fileId, {
      termCount: current.termCount + 1,
      masteredCount:
        current.masteredCount + (isMastered(box === undefined ? undefined : { box }) ? 1 : 0),
    })
  }
  return files.toSorted(byName).map((file) => ({
    ...file,
    ...(counts.get(file.id) ?? { termCount: 0, masteredCount: 0 }),
  }))
}
