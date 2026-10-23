import { describe, expect, it } from 'vitest'
import { AUTO_RELOAD_COOLDOWN_MS, shouldAutoReload } from './reload.ts'

describe('shouldAutoReload', () => {
  const now = Date.parse('2026-10-23T08:00:00Z')

  it('reloads when this tab has not reloaded for an outdated client yet', () => {
    expect(shouldAutoReload(undefined, now)).toBe(true)
  })

  it('does not reload again within the cooldown, so an old build cannot loop', () => {
    expect(shouldAutoReload(now - AUTO_RELOAD_COOLDOWN_MS + 1, now)).toBe(false)
  })

  it('reloads again once the cooldown has passed', () => {
    expect(shouldAutoReload(now - AUTO_RELOAD_COOLDOWN_MS, now)).toBe(true)
  })
})
