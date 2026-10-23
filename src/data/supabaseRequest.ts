import type { PostgrestError } from '@supabase/supabase-js'
import { ConnectionError, SessionExpiredError } from '../domain/errors.ts'

export type ConstraintHandler = (
  constraint: string,
) => Error | undefined | Promise<Error | undefined>

export interface SupabaseResponse {
  data: unknown
  error: PostgrestError | null
  status: number
}

export interface RequestOptions {
  /** Maps a unique or foreign key violation, by constraint name (part of the SQL contract). */
  onConstraint?: ConstraintHandler
  /** Told about every 401, so the app can ask the user to sign in again. */
  onSessionExpired?: () => void
  /** Maps an error our own SQL raises on purpose, by its errcode (e.g. `VC001`). */
  onErrorCode?: (code: string) => Error | undefined
}

/** Awaits a Supabase request and translates its error into a domain error. */
export async function runRequest(
  request: PromiseLike<SupabaseResponse>,
  { onConstraint, onSessionExpired, onErrorCode }: RequestOptions = {},
): Promise<unknown> {
  const { data, error, status } = await request
  if (!error) return data
  // supabase-js reports a failed fetch (offline, DNS, CORS) as status 0.
  if (status === 0) throw new ConnectionError()
  if (status === 401) {
    onSessionExpired?.()
    throw new SessionExpiredError()
  }
  if (error.code === '23505' || error.code === '23503') {
    const constraint = /constraint "([^"]+)"/.exec(error.message)?.[1]
    const mapped = constraint === undefined ? undefined : await onConstraint?.(constraint)
    if (mapped) throw mapped
  }
  const mapped = onErrorCode?.(error.code)
  if (mapped) throw mapped
  throw new Error(`Cloud request failed (${error.code}): ${error.message}`, { cause: error })
}
