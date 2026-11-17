import { isLearnable } from '../domain/learnable.ts'
import { isMastered } from '../domain/mastery.ts'
import type { TermKind, TermProgress, VocabFile } from '../domain/schemas.ts'
import { byName } from './ordering.ts'
import type { FileSummary } from './repository.ts'

/** One term of a folder, with only what the counts need; `box` is absent when never studied. */
export interface TermBox {
  fileId: string
  kind: TermKind
  box?: TermProgress['box']
}

type Counts = Omit<FileSummary, keyof VocabFile>
const NO_COUNTS: Counts = { termCount: 0, learnableCount: 0, masteredCount: 0 }

/**
 * The files of one folder with their counts, sorted as `getFolderContents` promises. Shared by
 * every repository so "term count" and "mastered" mean the same thing on every storage.
 */
export function summarizeFiles(
  files: readonly VocabFile[],
  terms: readonly TermBox[],
): FileSummary[] {
  const counts = new Map<string, Counts>()
  for (const { fileId, kind, box } of terms) {
    const current = counts.get(fileId) ?? NO_COUNTS
    // Only learnable terms count toward mastery; every term counts toward `termCount` (#90).
    const learnable = isLearnable({ kind })
    counts.set(fileId, {
      termCount: current.termCount + 1,
      learnableCount: current.learnableCount + (learnable ? 1 : 0),
      masteredCount:
        current.masteredCount +
        (learnable && isMastered(box === undefined ? undefined : { box }) ? 1 : 0),
    })
  }
  return files.toSorted(byName).map((file) => ({
    ...file,
    ...(counts.get(file.id) ?? NO_COUNTS),
  }))
}
