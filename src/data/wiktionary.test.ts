import { describe, expect, it, vi } from 'vitest'
import * as real from '../domain/pronunciation.fixtures.ts'
import { createWiktionaryLookup, LookupFailedError, WIKTIONARY_API } from './wiktionary.ts'

type Params = URLSearchParams
type Handler = (params: Params, init?: RequestInit) => Response | Promise<Response>

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

/** A page with an English Pronunciation section at index 7, revision 100. */
function sectionsOf(revid = 100) {
  return json({
    parse: {
      title: 'x',
      revid,
      sections: [
        { level: '2', line: 'English', index: '5' },
        { level: '3', line: 'Etymology', index: '6' },
        { level: '3', line: 'Pronunciation', index: '7' },
      ],
    },
  })
}

function fakeFetch(handler: Handler) {
  const calls: { params: Params; init: RequestInit | undefined }[] = []
  const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    expect(`${url.origin}${url.pathname}`).toBe(WIKTIONARY_API)
    calls.push({ params: url.searchParams, init })
    return handler(url.searchParams, init)
  })
  return { fetchFn: fetchFn as typeof fetch, calls }
}

/** Serves `pages` by title: their sections, then the wikitext of revision 100. */
function wiki(pages: Record<string, string>): Handler {
  return (params) => {
    const page = params.get('page')
    if (page !== null) {
      return page in pages
        ? sectionsOf()
        : json({ error: { code: 'missingtitle', info: "The page you specified doesn't exist." } })
    }
    const title = Object.keys(pages)[0]!
    return json({ parse: { title, wikitext: pages[title] } })
  }
}

describe('createWiktionaryLookup', () => {
  it('reads the sections, then the Pronunciation section of the same revision', async () => {
    const { fetchFn, calls } = fakeFetch(wiki({ run: real.run }))

    const result = await createWiktionaryLookup(fetchFn).lookUp('run')

    expect(result).toEqual({ kind: 'found', pronunciation: '/rʌn/' })
    expect(calls.map(({ params }) => Object.fromEntries(params))).toEqual([
      {
        action: 'parse',
        page: 'run',
        prop: 'sections|revid',
        redirects: '1',
        format: 'json',
        formatversion: '2',
        origin: '*',
      },
      {
        action: 'parse',
        oldid: '100',
        prop: 'wikitext',
        section: '7',
        format: 'json',
        formatversion: '2',
        origin: '*',
      },
    ])
    expect(calls[0]!.init?.headers).toEqual({
      'Api-User-Agent': 'vocab (https://github.com/nquynhtran/vocab)',
    })
  })

  it('sends the normalized word with straight quotes as the title', async () => {
    const { fetchFn, calls } = fakeFetch(wiki({}))
    await createWiktionaryLookup(fetchFn).lookUp('  don’t  ')
    expect(calls[0]!.params.get('page')).toBe("don't")
  })

  it('retries a capitalized word in lower case when the page is missing', async () => {
    const { fetchFn, calls } = fakeFetch(wiki({ run: real.run }))
    expect(await createWiktionaryLookup(fetchFn).lookUp('Run')).toEqual({
      kind: 'found',
      pronunciation: '/rʌn/',
    })
    expect(calls.map(({ params }) => params.get('page'))).toEqual(['Run', 'run', null])
  })

  it('retries in lower case when the page exists without a pronunciation', async () => {
    const { fetchFn, calls } = fakeFetch((params) => {
      if (params.get('page') === 'Give up') {
        return json({ parse: { revid: 1, sections: [{ level: 2, line: 'English', index: '1' }] } })
      }
      return wiki({ 'give up': real.giveUp })(params)
    })
    expect(await createWiktionaryLookup(fetchFn).lookUp('Give up')).toEqual({ kind: 'not-found' })
    expect(calls.map(({ params }) => params.get('page'))).toEqual(['Give up', 'give up', null])
  })

  it('reports not-found for a missing page, an invalid title or no usable pronunciation', async () => {
    for (const code of ['missingtitle', 'invalidtitle']) {
      const { fetchFn } = fakeFetch(() => json({ error: { code } }))
      expect(await createWiktionaryLookup(fetchFn).lookUp('xyzzy')).toEqual({ kind: 'not-found' })
    }
    const { fetchFn } = fakeFetch(wiki({ 'give up': real.giveUp }))
    expect(await createWiktionaryLookup(fetchFn).lookUp('give up')).toEqual({ kind: 'not-found' })
  })

  it('sends nothing for a word that cannot be a page title', async () => {
    const { fetchFn } = fakeFetch(wiki({}))
    expect(await createWiktionaryLookup(fetchFn).lookUp('C#')).toEqual({ kind: 'not-found' })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it.each<[string, Handler]>([
    ['a rate limit (429)', () => new Response('You are making too many requests', { status: 429 })],
    ['a server error', () => json({}, 502)],
    ['another API error', () => json({ error: { code: 'ratelimited' } })],
    ['HTML instead of JSON', () => new Response('<!DOCTYPE html><title>404</title>')],
    ['an unexpected shape', () => json({ parse: { revid: 'x', sections: null } })],
    [
      'an oversized section',
      (params) =>
        params.has('page')
          ? sectionsOf()
          : json({ parse: { wikitext: `* {{IPA|en|/x/}}${' '.repeat(200_000)}` } }),
    ],
    [
      'a network failure',
      () => {
        throw new TypeError('Failed to fetch')
      },
    ],
  ])('throws LookupFailedError for %s', async (_, handler) => {
    const { fetchFn } = fakeFetch(handler)
    await expect(createWiktionaryLookup(fetchFn).lookUp('run')).rejects.toBeInstanceOf(
      LookupFailedError,
    )
  })

  /** A fetch that never answers until its signal aborts, like a stalled connection. */
  const stalledFetch = (async (_: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('', 'AbortError')))
    })) as typeof fetch

  it('gives up with LookupFailedError after the timeout of the whole lookup', async () => {
    vi.useFakeTimers()
    try {
      const pending = createWiktionaryLookup(stalledFetch, 8000).lookUp('run')
      const assertion = expect(pending).rejects.toBeInstanceOf(LookupFailedError)
      await vi.advanceTimersByTimeAsync(8000)
      await assertion
    } finally {
      vi.useRealTimers()
    }
  })

  it('counts the timeout across both requests, not per request', async () => {
    vi.useFakeTimers()
    try {
      const { fetchFn } = fakeFetch(async (params, init) => {
        if (params.has('page')) {
          await new Promise((resolve) => setTimeout(resolve, 5000))
          return sectionsOf()
        }
        return stalledFetch(WIKTIONARY_API, init)
      })
      const pending = createWiktionaryLookup(fetchFn, 8000).lookUp('run')
      const assertion = expect(pending).rejects.toBeInstanceOf(LookupFailedError)
      await vi.advanceTimersByTimeAsync(8000)
      await assertion
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects with the abort reason, not LookupFailedError, when the caller aborts', async () => {
    const controller = new AbortController()
    const pending = createWiktionaryLookup(stalledFetch).lookUp('run', controller.signal)
    const reason = new DOMException('superseded', 'AbortError')
    controller.abort(reason)
    await expect(pending).rejects.toBe(reason)
  })
})
