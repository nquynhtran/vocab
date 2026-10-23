import react from '@vitejs/plugin-react'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// Only added to production builds: the dev server injects inline <style> tags for hot reload,
// which this policy would block. See docs/security.md.
function contentSecurityPolicyFor(supabaseOrigin: string): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    // No wss: realtime is not used.
    `connect-src 'self' ${supabaseOrigin}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

/**
 * The deployed app cannot work without these, and supabaseClient.ts would only notice once a user
 * opens the page, so a build that lacks them fails here instead (in CI, before deploying).
 */
function supabaseOriginFromEnv(mode: string): string {
  const env = loadEnv(mode, process.cwd(), 'VITE_SUPABASE_')
  const url = env.VITE_SUPABASE_URL ?? ''
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
  const missing = [!url && 'VITE_SUPABASE_URL', !key && 'VITE_SUPABASE_PUBLISHABLE_KEY'].filter(
    Boolean,
  )
  if (missing.length > 0) {
    throw new Error(`Set ${missing.join(' and ')} to build (GitHub Actions variables in CI)`)
  }
  // Ships to every visitor: only the publishable key may ever be here, never a secret one.
  if (!key.startsWith('sb_publishable_')) {
    throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY must be a publishable key (sb_publishable_…)')
  }
  const parsed = URL.canParse(url) ? new URL(url) : undefined
  if (parsed?.protocol !== 'https:') {
    throw new Error(`VITE_SUPABASE_URL must be an https URL, got "${url}"`)
  }
  return parsed.origin
}

function contentSecurityPolicy(): Plugin {
  let policy = ''
  return {
    name: 'content-security-policy',
    apply: 'build',
    configResolved: (config) => {
      policy = contentSecurityPolicyFor(supabaseOriginFromEnv(config.mode))
    },
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
        injectTo: 'head-prepend',
      },
    ],
  }
}

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the app from https://<user>.github.io/vocab/
  base: '/vocab/',
  plugins: [react(), contentSecurityPolicy()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
