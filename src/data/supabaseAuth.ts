import {
  isAuthApiError,
  isAuthRetryableFetchError,
  type SupabaseClient,
} from '@supabase/supabase-js'
import { AuthenticationError, parseOrThrow } from '../domain/errors.ts'
import { SignInInputSchema, type Auth, type AuthListener, type SignInInput } from './auth.ts'

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
