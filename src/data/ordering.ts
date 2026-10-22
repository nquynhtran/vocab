import type { Term } from '../domain/schemas.ts'
import { compareNames } from '../domain/text.ts'
import type { TermLocation } from './repository.ts'

// Orders promised by the Repository interface, shared by every implementation so the order never
// depends on the storage. Ties break on id so the order is stable across reloads.

export function byName(a: { id: string; name: string }, b: { id: string; name: string }): number {
  return compareNames(a.name, b.name) || compareCodeUnits(a.id, b.id)
}

type Placed = Pick<TermLocation, 'termId' | 'folderName' | 'fileName'>

export function byLocation(a: Placed, b: Placed): number {
  return (
    compareNames(a.folderName, b.folderName) ||
    compareNames(a.fileName, b.fileName) ||
    compareCodeUnits(a.termId, b.termId)
  )
}

export function newestFirst(a: Term, b: Term): number {
  return compareCodeUnits(b.createdAt, a.createdAt) || compareCodeUnits(a.id, b.id)
}

/** Plain ordinal order: ISO timestamps and UUIDs need no locale rules. */
function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
