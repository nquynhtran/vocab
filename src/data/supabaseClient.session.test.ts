import { afterEach, describe, expect, it, vi } from 'vitest'
import { AUTH_STORAGE_KEY, SupabaseClient } from './supabaseClient.ts'

// The app's own client keeps the session defaults; every other test turns them off, so a change
// here would otherwise sign everyone out on the next deploy with all tests green (decision #84).

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

let clients: SupabaseClient[] = []

/** Like the app: no session options, only a fake server. */
function appClient(respond: () => Response = () => json(SESSION)) {
  const fetch = vi.fn(async () => respond())
  const client = new SupabaseClient('https://ref.supabase.test', 'sb_publishable_key', { fetch })
  clients.push(client)
  return { client, fetch }
}

afterEach(async () => {
  for (const client of clients) await client.auth.stopAutoRefresh()
  clients = []
  localStorage.clear()
  window.location.hash = ''
})

describe('SupabaseClient session defaults', () => {
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
})
