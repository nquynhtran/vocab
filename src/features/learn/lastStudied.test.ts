import { describe, expect, it } from 'vitest'
import { lastStudied } from './lastStudied.ts'

// Tests run at UTC+7 (vitest TZ): 2026-11-03 at 06:00 there.
const now = new Date('2026-11-02T23:00:00.000Z')

describe('lastStudied', () => {
  it('counts calendar days on this device, not 24-hour periods', () => {
    // 23:30 the evening before, local time: only 6.5 hours ago, yet yesterday.
    expect(lastStudied('2026-11-02T16:30:00.000Z', now)).toBe('yesterday')
    expect(lastStudied('2026-11-02T17:30:00.000Z', now)).toBe('today')
    expect(lastStudied('2026-10-29T05:00:00.000Z', now)).toBe('5 days ago')
  })

  it('says today when the clock was set back', () => {
    expect(lastStudied('2026-11-10T05:00:00.000Z', now)).toBe('today')
  })
})
