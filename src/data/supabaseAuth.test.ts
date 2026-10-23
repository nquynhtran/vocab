// @vitest-environment node
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { AuthenticationError, ValidationError } from '../domain/errors.ts'
import { SupabaseAuth } from './supabaseAuth.ts'

function fakeAuth(respond: () => Response | Promise<Response>) {
  const fetch = vi.fn(async () => respond())
  const client = createClient('http://fake.test', 'fake-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  })
  return { auth: new SupabaseAuth(client), fetch }
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
