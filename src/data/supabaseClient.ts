import { AuthClient } from '@supabase/auth-js'
import { PostgrestClient } from '@supabase/postgrest-js'

/**
 * localStorage is shared by every GitHub Pages repo of the account (one origin), so the session
 * gets a key of its own instead of the default `sb-<ref>-auth-token`.
 */
export const AUTH_STORAGE_KEY = 'vocab-auth'

export interface SupabaseClientOptions {
  /** Tests turn both off: no localStorage in node, no refresh timer left running. */
  persistSession?: boolean
  autoRefreshToken?: boolean
  /** Tests answer requests themselves. */
  fetch?: typeof fetch
}

/**
 * The parts of Supabase the app uses: Auth, and the database (tables and RPC).
 *
 * Built from the two packages instead of supabase-js `createClient`, which always bundles the
 * realtime, storage and functions clients the app never calls (decision #84). The wiring copies
 * supabase-js 2.118 (`SupabaseClient` constructor, `fetchWithAuth`); recheck it when upgrading.
 */
export class SupabaseClient {
  readonly auth: InstanceType<typeof AuthClient>
  readonly from: PostgrestClient['from']
  readonly rpc: PostgrestClient['rpc']

  constructor(url: string, key: string, options: SupabaseClientOptions = {}) {
    const baseUrl = new URL(url.endsWith('/') ? url : `${url}/`)
    const baseFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
    this.auth = new AuthClient({
      url: new URL('auth/v1', baseUrl).href,
      headers: { Authorization: `Bearer ${key}`, apikey: key },
      storageKey: AUTH_STORAGE_KEY,
      persistSession: options.persistSession ?? true,
      autoRefreshToken: options.autoRefreshToken ?? true,
      // Sign-in is by password only, and the URL hash belongs to HashRouter.
      detectSessionInUrl: false,
      flowType: 'implicit',
      fetch: baseFetch,
    })
    const rest = new PostgrestClient(new URL('rest/v1', baseUrl).href, {
      schema: 'public',
      fetch: fetchWithSession(key, () => this.accessToken(), baseFetch),
    })
    this.from = rest.from.bind(rest)
    this.rpc = rest.rpc.bind(rest)
  }

  /** Refreshes an expired token first, like supabase-js. */
  private async accessToken(): Promise<string | undefined> {
    const { data } = await this.auth.getSession()
    return data.session?.access_token
  }
}

/**
 * Every database request carries the key, and the user's token when signed in (RLS reads the
 * user from it). Signed out, the key goes as the bearer too, as supabase-js sends it to PostgREST;
 * the server then answers 401, which the app reads as "session expired".
 */
function fetchWithSession(
  key: string,
  accessToken: () => Promise<string | undefined>,
  baseFetch: typeof fetch,
): typeof fetch {
  return async (input, init) => {
    const token = await accessToken()
    const headers = new Headers(init?.headers)
    if (!headers.has('apikey')) headers.set('apikey', key)
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token ?? key}`)
    return baseFetch(input, { ...init, headers })
  }
}

/**
 * The URL and publishable key are public (RLS decides access) but stay out of the code: dev reads
 * .env.development (local Supabase), the deployed build reads GitHub Actions variables.
 */
export function createSupabaseClient(env: ImportMetaEnv = import.meta.env): SupabaseClient {
  const url: unknown = env.VITE_SUPABASE_URL
  const key: unknown = env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (typeof url !== 'string' || !url || typeof key !== 'string' || !key) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set at build time')
  }
  return new SupabaseClient(url, key)
}
