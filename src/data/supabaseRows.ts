import type { z } from 'zod'
import { firstDifference } from '../domain/difference.ts'
import { InvalidStoredDataError } from '../domain/errors.ts'
import {
  FolderSchema,
  TermInputSchema,
  TermSchema,
  VocabFileSchema,
  type Folder,
  type Term,
  type VocabFile,
} from '../domain/schemas.ts'
import { toKey } from '../domain/text.ts'

/**
 * Converts between domain objects (camelCase, optional fields absent) and Postgres rows
 * (snake_case, every column present, null when unset). Column lists come from the domain
 * schemas' shape, so a field added to a schema is read and written without touching this file;
 * the SQL migration still has to add the column (docs/cloud-sync.md).
 */

export type Row = Record<string, unknown>
type ObjectSchema = z.ZodObject

/** Stored comparison keys and the text field each is computed from with `toKey`. */
const KEY_COLUMNS = [
  ['name_key', 'name'],
  ['word_key', 'word'],
] as const

/** Fields named like this hold an instant (`createdAt`, `lastWrongAt`...). */
const TIMESTAMP_SUFFIX = 'At'

function toSnakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

// ---- Reading (decision #35) ----

/**
 * Steps 1-3 of reading a cloud row: keep only the columns the schema knows (which drops
 * `user_id`, `name_key`, `word_key` and columns from newer migrations), null → absent, and
 * timestamps → `toISOString()`, since PostgREST answers `+00:00` with varying decimals while the
 * domain stores `…sssZ` and sorts by comparing those strings.
 * Not validated: used alone only where the Repository contract says so (exportBackup).
 */
export function convertRow<S extends ObjectSchema>(
  schema: S,
  row: unknown,
  location: string,
): z.output<S> {
  if (typeof row !== 'object' || row === null || Array.isArray(row)) {
    throw new InvalidStoredDataError(location, 'expected a row')
  }
  const source = row as Row
  const entity: Row = {}
  for (const key of Object.keys(schema.shape)) {
    const value = source[toSnakeCase(key)]
    if (value === null || value === undefined) continue
    entity[key] = key.endsWith(TIMESTAMP_SUFFIX) ? normalizeTimestamp(value) : value
  }
  return entity as z.output<S>
}

/**
 * Converts, then validates with the domain schema. Parsing must not change anything: the
 * schemas normalize text, so a difference means the row was not written by this app (e.g. a
 * hand edit). That is an error, not a silent fix. A key column present in the row must equal
 * `toKey` of its text: a hand edit of `name` alone would otherwise let duplicates in and make
 * duplicate warnings miss words.
 */
export function parseRow<S extends ObjectSchema>(
  schema: S,
  row: unknown,
  location: string,
): z.output<S> {
  const entity = convertRow(schema, row, location)
  const result = schema.safeParse(entity)
  if (!result.success) {
    const issue = result.error.issues[0]
    throw new InvalidStoredDataError(
      [location, issue?.path.join('.')].filter(Boolean).join(': '),
      issue?.message ?? 'invalid value',
    )
  }
  const changed = firstDifference(entity, result.data)
  if (changed !== undefined) {
    throw new InvalidStoredDataError(`${location}: ${changed}`, 'value is not normalized')
  }
  const source = row as Row
  const parsed = result.data as Row
  for (const [column, field] of KEY_COLUMNS) {
    if (!(column in source) || typeof parsed[field] !== 'string') continue
    if (source[column] !== toKey(parsed[field])) {
      throw new InvalidStoredDataError(`${location}: ${column}`, `does not match ${field}`)
    }
  }
  return result.data
}

/** Unparseable values are left as they are, for the schema to reject. */
function normalizeTimestamp(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString()
}

/** The array held by `key` of an RPC result, which is jsonb and so unchecked by any type. */
export function arrayField(value: unknown, key: string, location: string): unknown[] {
  const field = (value as Row | null)?.[key]
  if (!Array.isArray(field))
    throw new InvalidStoredDataError(`${location}: ${key}`, 'expected a list')
  return field
}

/** The object held by `key` of a row, e.g. an embedded parent. */
export function objectField(value: unknown, key: string, location: string): unknown {
  const field = (value as Row | null)?.[key]
  if (typeof field !== 'object' || field === null) {
    throw new InvalidStoredDataError(`${location}: ${key}`, 'expected a row')
  }
  return field
}

// ---- Writing (decision #34) ----

/**
 * Every column the schema knows, null for an absent field. Writes always list every column, so
 * clearing a field really clears it, and no column is left for the database to keep stale.
 */
export function entityToRow(schema: ObjectSchema, entity: object): Row {
  const source = entity as Row
  return Object.fromEntries(
    Object.keys(schema.shape).map((key) => [toSnakeCase(key), source[key] ?? null]),
  )
}

// Comparison keys are computed here, by the same `toKey` as local storage (decision #21).

/** A folder or file name with its key, also what a rename writes. */
export function nameColumns(name: string): Row {
  return { name, name_key: toKey(name) }
}

export function folderToRow(folder: Folder): Row {
  return { ...entityToRow(FolderSchema, folder), ...nameColumns(folder.name) }
}

export function fileToRow(file: VocabFile): Row {
  return { ...entityToRow(VocabFileSchema, file), ...nameColumns(file.name) }
}

export function termToRow(term: Term): Row {
  return { ...entityToRow(TermSchema, term), word_key: toKey(term.word) }
}

/** The columns an edit replaces: the content, never id, file or creation time. */
export function termContentToRow(content: z.output<typeof TermInputSchema>): Row {
  return { ...entityToRow(TermInputSchema, content), word_key: toKey(content.word) }
}
