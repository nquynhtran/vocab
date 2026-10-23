import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * localStorage is shared by every GitHub Pages repo of the account (one origin), so the session
 * gets a key of its own instead of the default `sb-<ref>-auth-token`.
 */
export const AUTH_STORAGE_KEY = 'vocab-auth'

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
  return createClient(url, key, {
    auth: {
      storageKey: AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      // Sign-in is by password only, and the URL hash belongs to HashRouter.
      detectSessionInUrl: false,
    },
  })
}
