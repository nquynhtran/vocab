// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { AuthenticationError, ValidationError } from '../domain/errors.ts'
import { SupabaseAuth } from './supabaseAuth.ts'
import { SupabaseClient } from './supabaseClient.ts'

function fakeAuth(respond: () => Response | Promise<Response>) {
  const fetch = vi.fn(async () => respond())
  const client = new SupabaseClient('http://fake.test', 'fake-key', {
    persistSession: false,
    autoRefreshToken: false,
    fetch,
  })
  return { auth: new SupabaseAuth(client), client, fetch }
}

/** Like the real Auth server: error codes are read only with an API version header. */
const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' },
  })

const CREDENTIALS = { email: 'me@example.com', password: 'secret' }

describe('SupabaseAuth.signIn', () => {
  it('rejects empty fields before asking the server', async () => {
    const { auth, fetch } = fakeAuth(() => json({}, 200))
    const error = await auth.signIn({ email: '  ', password: '' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).fieldErrors).toEqual({
      email: ['Email is required'],
      password: ['Password is required'],
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports wrong credentials in words', async () => {
    const { auth } = fakeAuth(() =>
      json({ code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400),
    )
    await expect(auth.signIn(CREDENTIALS)).rejects.toThrow(
      new AuthenticationError('Wrong email or password.'),
    )
  })

  it('reports rate limiting', async () => {
    const { auth } = fakeAuth(() =>
      json({ code: 'over_request_rate_limit', msg: 'Request rate limit reached' }, 429),
    )
    await expect(auth.signIn(CREDENTIALS)).rejects.toThrow(/Too many attempts/)
  })

  it.each([
    ['offline', () => Promise.reject(new TypeError('fetch failed'))],
    ['a server error', () => json({ code: 'unexpected_failure', msg: 'boom' }, 500)],
  ])('reports %s as an unreachable or busy server', async (_, respond) => {
    const { auth } = fakeAuth(respond)
    const error = await auth.signIn(CREDENTIALS).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthenticationError)
    expect((error as Error).message).toMatch(/cannot be reached or is busy/)
  })

  it('treats any other failure as a bug, keeping the cause', async () => {
    const { auth } = fakeAuth(() =>
      json({ code: 'email_not_confirmed', msg: 'Not confirmed' }, 400),
    )
    const error = await auth.signIn(CREDENTIALS).catch((e: unknown) => e)
    expect(error).not.toBeInstanceOf(AuthenticationError)
    expect((error as Error).cause).toBeDefined()
  })
})

describe('SupabaseAuth.subscribe', () => {
  it('reports nobody signed in when there is no stored session', async () => {
    const { auth } = fakeAuth(() => json({}, 200))
    const listener = vi.fn()
    const unsubscribe = auth.subscribe(listener)
    await vi.waitFor(() => expect(listener).toHaveBeenCalledWith(null))
    unsubscribe()
  })
})

describe('SupabaseAuth.expireSession', () => {
  const SESSION = {
    access_token: 'token',
    refresh_token: 'refresh',
    token_type: 'bearer',
    // Not near expiry, so auth-js does not try to refresh it during these tests.
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: 'me', aud: 'authenticated', role: 'authenticated', email: 'me@example.com' },
  }

  /** A signed-in client whose `/user` check answers with `user`; records sign-outs. */
  async function signedIn(user: () => Response | Promise<Response>) {
    let respond: () => Response | Promise<Response> = () => json(SESSION, 200)
    const { auth } = fakeAuth(() => respond())
    const listener = vi.fn()
    auth.subscribe(listener)
    await auth.signIn(CREDENTIALS)
    respond = user
    listener.mockClear()
    return { auth, listener }
  }

  it('keeps a session the server still accepts: the 401 belonged to an earlier one', async () => {
    const { auth, listener } = await signedIn(() => json(SESSION.user, 200))
    await auth.expireSession()
    expect(listener).not.toHaveBeenCalledWith(null)
  })

  // Only `session_not_found` is dropped by auth-js itself; the others need our sign-out.
  it.each([
    ['an expired token', 401, 'bad_jwt'],
    ['a bad token', 403, 'bad_jwt'],
    ['a deleted user', 403, 'user_not_found'],
    ['a revoked session', 403, 'session_not_found'],
  ])('ends the session on %s', async (_, status, code) => {
    const { auth, listener } = await signedIn(() => json({ code, msg: 'Rejected' }, status))
    await auth.expireSession()
    expect(listener).toHaveBeenCalledWith(null)
  })

  it.each<[string, () => Response | Promise<Response>]>([
    ['offline', () => Promise.reject(new TypeError('fetch failed'))],
    ['a server error', () => json({ code: 'unexpected_failure', msg: 'boom' }, 500)],
    ['rate limiting', () => json({ code: 'over_request_rate_limit', msg: 'Slow down' }, 429)],
    ['rate limiting in plain text', () => new Response('Too many requests', { status: 429 })],
    ['a timeout', () => json({ code: 'request_timeout', msg: 'Timeout' }, 408)],
    ["a proxy's error page", () => new Response('<html>Blocked</html>', { status: 403 })],
  ])('keeps the session when it cannot tell: %s', async (_, respond) => {
    const { auth, listener } = await signedIn(respond)
    await auth.expireSession()
    expect(listener).not.toHaveBeenCalledWith(null)
  })

  it('checks once for a burst of 401s, and again for a later one', async () => {
    const check = vi.fn(() => json(SESSION.user, 200))
    const { auth } = await signedIn(check)

    await Promise.all([auth.expireSession(), auth.expireSession(), auth.expireSession()])
    expect(check).toHaveBeenCalledOnce()

    await auth.expireSession()
    expect(check).toHaveBeenCalledTimes(2)
  })

  it('does not sign out when nobody is signed in: a sign-in may be on its way', async () => {
    const { auth, client } = fakeAuth(() => json({}, 200))
    const signOut = vi.spyOn(client.auth, 'signOut')
    await auth.expireSession()
    expect(signOut).not.toHaveBeenCalled()
  })
})
