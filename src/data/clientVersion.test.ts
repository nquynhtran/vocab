// @vitest-environment node
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { InvalidStoredDataError, SessionExpiredError } from '../domain/errors.ts'
import { CLIENT_VERSION, isClientOutdated } from './clientVersion.ts'

function fakeClient(response: () => Response) {
  return createClient('http://fake.test', 'fake-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async () => response() },
  })
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('isClientOutdated', () => {
  it('is false while the cloud requires this version or an older one', async () => {
    const client = fakeClient(() => json({ min_client_version: CLIENT_VERSION }))
    expect(await isClientOutdated(client)).toBe(false)
  })

  it('is true once the cloud requires a newer version', async () => {
    const client = fakeClient(() => json({ min_client_version: CLIENT_VERSION + 1 }))
    expect(await isClientOutdated(client)).toBe(true)
  })

  it('rejects a config that is not a positive integer instead of letting old code run', async () => {
    for (const value of [null, '2', 0, 1.5]) {
      const client = fakeClient(() => json({ min_client_version: value }))
      await expect(isClientOutdated(client)).rejects.toBeInstanceOf(InvalidStoredDataError)
    }
  })

  it('reports a 401 to onSessionExpired', async () => {
    const onSessionExpired = vi.fn()
    const client = fakeClient(() =>
      json({ code: '42501', message: 'permission denied for table app_config' }, 401),
    )
    await expect(isClientOutdated(client, onSessionExpired)).rejects.toBeInstanceOf(
      SessionExpiredError,
    )
    expect(onSessionExpired).toHaveBeenCalledOnce()
  })
})
