import {
  isAuthApiError,
  isAuthRetryableFetchError,
  type SupabaseClient,
} from '@supabase/supabase-js'
import { z } from 'zod'
import { parseOrThrow } from '../domain/errors.ts'

export const SignInInputSchema = z.object({
  email: z.string().trim().min(1, { error: 'Email is required' }),
  password: z.string().min(1, { error: 'Password is required' }),
})
export type SignInInput = z.input<typeof SignInInputSchema>

/** `null` when nobody is signed in. */
export type AuthListener = (userId: string | null) => void

/** What the UI knows about signing in, so tests can pass a fake (as with Repository). */
export interface Auth {
  /** Calls `listener` soon with the current user, then after every change. Returns unsubscribe. */
  subscribe(listener: AuthListener): () => void
  signIn(input: SignInInput): Promise<void>
  /** Signs out on this device only. */
  signOut(): Promise<void>
  /**
   * Forgets a session the server rejected (401) while this device still holds it, e.g. after it
   * was revoked, so listeners hear `null` and the UI asks for a new sign-in.
   */
  expireSession(): Promise<void>
}

/** A sign-in or sign-out failure, with a message written for the user. */
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class SupabaseAuth implements Auth {
  private readonly client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  subscribe(listener: AuthListener): () => void {
    // Only sets state: supabase-js warns that awaiting its own calls in here can deadlock.
    const { data } = this.client.auth.onAuthStateChange((_event, session) =>
      listener(session?.user.id ?? null),
    )
    return () => data.subscription.unsubscribe()
  }

  async signIn(input: SignInInput): Promise<void> {
    const credentials = parseOrThrow(SignInInputSchema, input)
    const { error } = await this.client.auth.signInWithPassword(credentials)
    if (error) throw authenticationError(error, 'Cannot sign in')
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut({ scope: 'local' })
    // supabase-js forgets the session on this device even when the server cannot be reached;
    // only its refresh token stays valid on the server until it expires. Signed out is signed out.
    if (error && !isAuthRetryableFetchError(error))
      throw authenticationError(error, 'Cannot sign out')
  }

  async expireSession(): Promise<void> {
    // Drops the local session whatever the server answers (401 for the rejected token, or no
    // answer at all), so listeners hear null.
    await this.client.auth.signOut({ scope: 'local' })
  }
}

function authenticationError(error: unknown, action: string): Error {
  // Offline, and also any 5xx: supabase-js counts both as worth retrying.
  if (isAuthRetryableFetchError(error)) {
    return new AuthenticationError(
      `${action}: the server cannot be reached or is busy. Check your connection and try again.`,
    )
  }
  if (isAuthApiError(error) && error.code === 'invalid_credentials') {
    return new AuthenticationError('Wrong email or password.')
  }
  if (isAuthApiError(error) && error.status === 429) {
    return new AuthenticationError('Too many attempts. Wait a few minutes and try again.')
  }
  return new Error(`${action}: ${String(error)}`, { cause: error })
}
