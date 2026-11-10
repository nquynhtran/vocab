// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { SupabaseClient } from './supabaseClient.ts'

const SESSION = {
  access_token: 'user-token',
  refresh_token: 'refresh',
  token_type: 'bearer',
  // Not near expiry, so the client does not try to refresh it.
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: 'me', aud: 'authenticated', role: 'authenticated', email: 'me@example.com' },
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

/** Answers sign-in with SESSION and every database request with `[]`; records what was sent. */
function recordingClient() {
  const sent: { url: string; headers: Headers }[] = []
  const client = new SupabaseClient('https://ref.supabase.test', 'sb_publishable_key', {
    persistSession: false,
    autoRefreshToken: false,
    fetch: async (input, init) => {
      const url = String(input instanceof Request ? input.url : input)
      sent.push({ url, headers: new Headers(init?.headers) })
      return json(url.includes('/auth/v1/') ? SESSION : [])
    },
  })
  const lastDatabaseRequest = () =>
    sent.filter((request) => request.url.includes('/rest/v1/')).at(-1)
  return { client, lastDatabaseRequest }
}

// The cloud contract suite covers this against a real server, but runs only on a machine with
// local Supabase; a broken header there would otherwise reach CI green (decision #84).
describe('SupabaseClient', () => {
  it('sends the key, and the key as bearer, while signed out', async () => {
    const { client, lastDatabaseRequest } = recordingClient()
    await client.from('folders').select('id')
    const request = lastDatabaseRequest()
    expect(request?.url).toBe('https://ref.supabase.test/rest/v1/folders?select=id')
    expect(request?.headers.get('apikey')).toBe('sb_publishable_key')
    expect(request?.headers.get('Authorization')).toBe('Bearer sb_publishable_key')
  })

  it("sends the user's token once signed in, to tables and RPC alike", async () => {
    const { client, lastDatabaseRequest } = recordingClient()
    const { error } = await client.auth.signInWithPassword({
      email: 'me@example.com',
      password: 'x',
    })
    expect(error).toBeNull()

    await client.from('folders').select('id')
    expect(lastDatabaseRequest()?.headers.get('Authorization')).toBe('Bearer user-token')
    await client.rpc('list_study_days')
    const rpc = lastDatabaseRequest()
    expect(rpc?.url).toBe('https://ref.supabase.test/rest/v1/rpc/list_study_days')
    expect(rpc?.headers.get('Authorization')).toBe('Bearer user-token')
    expect(rpc?.headers.get('apikey')).toBe('sb_publishable_key')
  })
})
