import { z } from 'zod'

/** Every repository throws these, so the UI can tell them apart without knowing the storage. */

export class ValidationError extends Error {
  /** Messages per input field, ready to show next to the form field. */
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>

  constructor(fieldErrors: Readonly<Record<string, readonly string[]>>) {
    super(Object.values(fieldErrors).flat().join('. ') || 'Invalid input')
    this.name = 'ValidationError'
    this.fieldErrors = fieldErrors
  }
}

export type NamedEntityKind = 'folder' | 'file'
export type EntityKind = NamedEntityKind | 'term'

export class DuplicateNameError extends Error {
  readonly kind: NamedEntityKind
  readonly existingName: string

  constructor(kind: NamedEntityKind, existingName: string) {
    super(
      kind === 'folder'
        ? `A folder named "${existingName}" already exists.`
        : `A file named "${existingName}" already exists in this folder.`,
    )
    this.name = 'DuplicateNameError'
    this.kind = kind
    this.existingName = existingName
  }
}

/**
 * Not named "NotFoundError": Dexie rewraps any error whose `name` matches an IndexedDB DOM
 * error ("NotFoundError", "ConstraintError", "DataError"...) into its own class, so an error
 * thrown inside a transaction under such a name would lose its type. Avoid those names.
 */
export class EntityNotFoundError extends Error {
  readonly kind: EntityKind
  readonly id: string

  constructor(kind: EntityKind, id: string) {
    super(`This ${kind} no longer exists. It may have been deleted in another tab.`)
    this.name = 'EntityNotFoundError'
    this.kind = kind
    this.id = id
  }
}

/**
 * No answer from the cloud. For a write this does not mean nothing was saved: the request may
 * have been applied and only the answer lost, so retrying blindly could add a term twice.
 */
export class ConnectionError extends Error {
  constructor() {
    super(
      'Cannot reach the server. Check your connection and reload: ' +
        'a change you just made may or may not have been saved.',
    )
    this.name = 'ConnectionError'
  }
}

/** The cloud refused the request because nobody is signed in any more (HTTP 401). */
export class SessionExpiredError extends Error {
  constructor() {
    super('Your session has expired. Please sign in again.')
    this.name = 'SessionExpiredError'
  }
}

/**
 * A row read from the cloud is not what this app writes, e.g. after a hand edit in the dashboard.
 * Thrown for the whole read instead of skipping the row (decision #35), so nothing silently
 * disappears from a list.
 */
export class InvalidStoredDataError extends Error {
  /** Where the bad value is, e.g. `terms 0b5c…: word`. */
  readonly location: string

  constructor(location: string, problem: string) {
    super(
      `Data in the cloud is invalid (${location}: ${problem}). ` +
        'Fix it in the Supabase dashboard or restore a backup.',
    )
    this.name = 'InvalidStoredDataError'
    this.location = location
  }
}

/** Fail fast at the boundary: invalid input never reaches storage. */
export function parseOrThrow<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value)
  if (!result.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of result.error.issues) {
      const field = issue.path.join('.') || '_'
      fieldErrors[field] = [...(fieldErrors[field] ?? []), issue.message]
    }
    throw new ValidationError(fieldErrors)
  }
  return result.data
}
