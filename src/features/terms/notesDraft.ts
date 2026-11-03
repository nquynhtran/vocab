import { z } from 'zod'

/**
 * Unsaved notes, per file, on this device only (#65): on an iPhone, switching to Safari to copy
 * a reading can reload the page. localStorage can be missing or throw (private mode, full):
 * editing then works as before, without a draft.
 */
const keyFor = (fileId: string) => `vocab-notes-draft:${fileId}`

const DraftSchema = z.object({ text: z.string() })

/** `undefined` when there is none or it cannot be read; an unreadable draft is removed. */
export function readNotesDraft(fileId: string): string | undefined {
  try {
    const raw = localStorage.getItem(keyFor(fileId))
    if (raw === null) return undefined
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = undefined
    }
    const draft = DraftSchema.safeParse(parsed)
    if (draft.success) return draft.data.text
    clearNotesDraft(fileId)
    return undefined
  } catch {
    return undefined
  }
}

export function writeNotesDraft(fileId: string, text: string): void {
  try {
    localStorage.setItem(keyFor(fileId), JSON.stringify({ text }))
  } catch {
    // Storage unusable or full: the text is still in the box, only the safety copy is missing.
  }
}

export function clearNotesDraft(fileId: string): void {
  try {
    localStorage.removeItem(keyFor(fileId))
  } catch {
    // Storage unusable: there is nothing to remove either.
  }
}
