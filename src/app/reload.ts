/** Long enough that GitHub Pages (cached ~10 minutes) has had a chance to serve the new build. */
export const AUTO_RELOAD_COOLDOWN_MS = 5 * 60 * 1000

const LAST_RELOAD_KEY = 'vocab-outdated-reload-at'

/**
 * Whether to reload by itself because the cloud asked for a newer client. Not again soon after
 * doing so: if `min_client_version` was raised before the new build is live, reloading would
 * fetch the same old code and loop forever.
 */
export function shouldAutoReload(lastReloadAt: number | undefined, now: number): boolean {
  return lastReloadAt === undefined || now - lastReloadAt >= AUTO_RELOAD_COOLDOWN_MS
}

/** sessionStorage: per tab, gone when the tab closes. Unavailable storage just allows reloading. */
export function lastOutdatedReload(): number | undefined {
  try {
    const value = Number(sessionStorage.getItem(LAST_RELOAD_KEY))
    return value > 0 ? value : undefined
  } catch {
    return undefined
  }
}

export function rememberOutdatedReload(now: number): void {
  try {
    sessionStorage.setItem(LAST_RELOAD_KEY, String(now))
  } catch {
    // Without storage the cooldown cannot work; reloading is still the right thing to do once.
  }
}
