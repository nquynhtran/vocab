import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AUTH_STORAGE_KEY, createSupabaseClient } from './supabaseClient.ts'

// Every other test builds its client with persistSession off, so the app's own session settings
// would otherwise go untested: a change here could sign everyone out on the next deploy.

const SESSION = {
  access_token: 'user-token',
  refresh_token: 'refresh',
  token_type: 'bearer',
  // Not near expiry, so the client does not try to refresh it.
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: 'me', aud: 'authenticated', role: 'authenticated', email: 'me@example.com' },
}

const ENV = {
  ...import.meta.env,
  VITE_SUPABASE_URL: 'https://ref.supabase.test',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_key',
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

let clients: SupabaseClient[] = []

/** The app's client against a fake server: SESSION for Auth, `[]` for the database. */
function appClient() {
  const sent: { url: string; headers: Headers }[] = []
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    sent.push({ url, headers: new Headers(init?.headers) })
    return json(url.includes('/auth/v1/') ? SESSION : [])
  })
  const client = createSupabaseClient(ENV, fetch)
  clients.push(client)
  const lastDatabaseRequest = () =>
    sent.filter((request) => request.url.includes('/rest/v1/')).at(-1)
  return { client, fetch, lastDatabaseRequest }
}

afterEach(async () => {
  for (const client of clients) await client.auth.stopAutoRefresh()
  clients = []
  localStorage.clear()
  window.location.hash = ''
})

describe('createSupabaseClient', () => {
  it('keeps the session in localStorage under its own key', async () => {
    const { client } = appClient()
    await client.auth.signInWithPassword({ email: 'me@example.com', password: 'x' })
    const stored: unknown = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? 'null')
    expect(stored).toMatchObject({ access_token: 'user-token' })
    expect(AUTH_STORAGE_KEY).toBe('vocab-auth')
  })

  it('reads a session stored by an earlier visit without asking the server', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(SESSION))
    const { client, fetch } = appClient()
    const { data } = await client.auth.getSession()
    expect(data.session?.access_token).toBe('user-token')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('ignores tokens in the URL hash, which belongs to HashRouter', async () => {
    window.location.hash =
      '#access_token=from-url&refresh_token=r&expires_in=3600&token_type=bearer'
    const { client, fetch } = appClient()
    const { data } = await client.auth.getSession()
    expect(data.session).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("sends the user's token to tables and RPC once signed in", async () => {
    const { client, lastDatabaseRequest } = appClient()
    await client.auth.signInWithPassword({ email: 'me@example.com', password: 'x' })
    await client.from('folders').select('id')
    expect(lastDatabaseRequest()?.headers.get('Authorization')).toBe('Bearer user-token')
    await client.rpc('list_study_days')
    expect(lastDatabaseRequest()?.url).toBe('https://ref.supabase.test/rest/v1/rpc/list_study_days')
    expect(lastDatabaseRequest()?.headers.get('Authorization')).toBe('Bearer user-token')
  })
})
