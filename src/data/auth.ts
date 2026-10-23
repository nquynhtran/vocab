import { z } from 'zod'

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
