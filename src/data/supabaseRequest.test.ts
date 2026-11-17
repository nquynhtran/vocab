import { describe, expect, it } from 'vitest'
import { ConnectionError, OutdatedClientError } from '../domain/errors.ts'
import { runRequest } from './supabaseRequest.ts'

type Request = Parameters<typeof runRequest>[0]

/**
 * A response as supabase-js reports it. Only `code`, `message` and `status` matter here; the cast
 * stands in for the PostgrestError fields (details, hint) the mapper never reads.
 */
function answer(error: { code: string; message: string } | null, status = 400): Request {
  const response = { data: null, error, status, count: null, statusText: '' }
  return Promise.resolve(response) as unknown as Request
}

describe('runRequest', () => {
  it('turns the write gate refusal into a reload message, for any write (#90)', async () => {
    await expect(runRequest(answer({ code: 'VC003', message: 'too old' }))).rejects.toBeInstanceOf(
      OutdatedClientError,
    )
  })

  it('lets the caller map its own codes first', async () => {
    const mapped = new Error('mapped')
    await expect(
      runRequest(answer({ code: 'VC002', message: 'x' }), { onErrorCode: () => mapped }),
    ).rejects.toBe(mapped)
  })

  it('reports an unknown error without a code as a connection problem, not as a value', async () => {
    await expect(runRequest(answer({ code: '', message: 'x' }, 0))).rejects.toBeInstanceOf(
      ConnectionError,
    )
  })
})
