import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/auth-js'
import { AuthenticationError, parseOrThrow } from '../domain/errors.ts'
import type { SupabaseClient } from './supabaseClient.ts'
import { SignInInputSchema, type Auth, type AuthListener, type SignInInput } from './auth.ts'

export class SupabaseAuth implements Auth {
  private readonly client: SupabaseClient
  private expiring: Promise<void> | undefined

  constructor(client: SupabaseClient) {
    this.client = client
  }

  subscribe(listener: AuthListener): () => void {
    // Only sets state: auth-js warns that awaiting its own calls in here can deadlock.
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
    // auth-js forgets the session on this device even when the server cannot be reached;
    // only its refresh token stays valid on the server until it expires. Signed out is signed out.
    if (error && !isAuthRetryableFetchError(error))
      throw authenticationError(error, 'Cannot sign out')
  }

  /**
   * A 401 says nothing about which session the request carried: one sent earlier, or while
   * signed out, can arrive just after the user signed in again, and must not end the new session
   * (decision #75). So the current session is what gets checked, once for a burst of 401s: the
   * sign-in dialog only appears after the first check, so a later one could not be about a
   * session signed in meanwhile.
   */
  expireSession(): Promise<void> {
    this.expiring ??= this.endRejectedSession().finally(() => {
      this.expiring = undefined
    })
    return this.expiring
  }

  private async endRejectedSession(): Promise<void> {
    const { data } = await this.client.auth.getSession()
    // Nothing to end, and signing out now could wipe a sign-in that lands at the same moment.
    if (data.session === null) return
    const { error } = await this.client.auth.getUser()
    // Only the server rejecting this session ends it. Offline, 429, a proxy's error page: cannot
    // tell, and the next request that gets through will show.
    if (!isAuthApiError(error) || (error.status !== 401 && error.status !== 403)) return
    // Drops the session whatever signOut's own request answers, so listeners hear null.
    await this.client.auth.signOut({ scope: 'local' })
  }
}

function authenticationError(error: unknown, action: string): Error {
  // Offline, and also any 5xx: auth-js counts both as worth retrying.
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
