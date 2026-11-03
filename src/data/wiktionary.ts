import { z } from 'zod'
import {
  findPronunciationSection,
  pickPronunciation,
  wiktionaryTitles,
} from '../domain/pronunciation.ts'

/**
 * The Look up button's dictionary: Wiktionary's MediaWiki API, called straight from the browser
 * (CORS with `origin=*`, no key). Rules: docs/pronunciation-lookup.md.
 */

export type LookupResult = { kind: 'found'; pronunciation: string } | { kind: 'not-found' }

/** Network error, HTTP error (429 included), unexpected response or timeout. */
export class LookupFailedError extends Error {
  constructor(options?: ErrorOptions) {
    super('The dictionary could not be reached', options)
    this.name = 'LookupFailedError'
  }
}

/** What the UI depends on, so tests can use a fake (docs/architecture.md). */
export interface PronunciationLookup {
  /**
   * A suggestion for the typed word, or `not-found`. Throws `LookupFailedError`, or the abort
   * reason when `signal` aborts (the caller no longer wants the answer).
   */
  lookUp(word: string, signal?: AbortSignal): Promise<LookupResult>
}

export const WIKTIONARY_API = 'https://en.wiktionary.org/w/api.php'
/** For the whole lookup (every request), not per request. */
export const LOOKUP_TIMEOUT_MS = 8000
/** A Pronunciation section is a few KB; anything far bigger is not what we asked for. */
const MAX_WIKITEXT_LENGTH = 200_000

/** Wikimedia asks browser clients to identify themselves with this header (it allows it in CORS). */
const HEADERS = { 'Api-User-Agent': 'vocab (https://github.com/nquynhtran/vocab)' }

const ApiErrorSchema = z.object({ error: z.object({ code: z.string() }) })
const SectionsSchema = z.object({
  parse: z.object({
    revid: z.int().positive(),
    sections: z.array(
      z.object({
        level: z.union([z.string(), z.number()]).transform(Number),
        line: z.string(),
        index: z.string(),
      }),
    ),
  }),
})
const WikitextSchema = z.object({
  parse: z.object({ wikitext: z.string().max(MAX_WIKITEXT_LENGTH) }),
})

/** Codes meaning "no such page" rather than a failure. */
const NOT_FOUND_CODES = new Set(['missingtitle', 'invalidtitle'])

export function createWiktionaryLookup(
  fetchFn: typeof fetch = (...args) => fetch(...args),
  timeoutMs = LOOKUP_TIMEOUT_MS,
): PronunciationLookup {
  return {
    async lookUp(word, signal) {
      // One controller for the whole lookup; setTimeout because AbortSignal.timeout needs iOS 16.
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(new LookupFailedError()), timeoutMs)
      const onAbort = () => controller.abort(signal?.reason)
      signal?.addEventListener('abort', onAbort)
      if (signal?.aborted) onAbort()
      try {
        for (const title of wiktionaryTitles(word)) {
          const result = await lookUpTitle(fetchFn, title, controller.signal)
          if (result.kind === 'found') return result
        }
        return { kind: 'not-found' }
      } catch (error) {
        if (controller.signal.aborted) throw controller.signal.reason
        if (error instanceof LookupFailedError) throw error
        throw new LookupFailedError({ cause: error })
      } finally {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
      }
    },
  }
}

async function lookUpTitle(
  fetchFn: typeof fetch,
  title: string,
  signal: AbortSignal,
): Promise<LookupResult> {
  const sections = await callApi(
    fetchFn,
    { page: title, prop: 'sections|revid', redirects: '1' },
    signal,
  )
  if (sections === undefined) return { kind: 'not-found' }
  const { revid, sections: list } = parseOrFail(SectionsSchema, sections).parse
  const index = findPronunciationSection(list)
  if (index === undefined) return { kind: 'not-found' }

  // The same revision as the section list: an edit in between could move the index.
  const section = await callApi(
    fetchFn,
    { oldid: String(revid), prop: 'wikitext', section: index },
    signal,
  )
  if (section === undefined) return { kind: 'not-found' }
  const pronunciation = pickPronunciation(parseOrFail(WikitextSchema, section).parse.wikitext)
  return pronunciation === undefined ? { kind: 'not-found' } : { kind: 'found', pronunciation }
}

/** The parsed JSON of one `action=parse` call, or `undefined` for a page that does not exist. */
async function callApi(
  fetchFn: typeof fetch,
  params: Record<string, string>,
  signal: AbortSignal,
): Promise<unknown> {
  const query = new URLSearchParams({
    action: 'parse',
    ...params,
    format: 'json',
    formatversion: '2',
    origin: '*',
  })
  const response = await fetchFn(`${WIKTIONARY_API}?${query}`, { headers: HEADERS, signal })
  if (!response.ok) throw new LookupFailedError()
  const body: unknown = await response.json()
  const apiError = ApiErrorSchema.safeParse(body)
  if (!apiError.success) return body
  if (NOT_FOUND_CODES.has(apiError.data.error.code)) return undefined
  throw new LookupFailedError()
}

function parseOrFail<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new LookupFailedError({ cause: parsed.error })
  return parsed.data
}
