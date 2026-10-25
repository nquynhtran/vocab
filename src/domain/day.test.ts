import { describe, expect, it } from 'vitest'
import { daysBetween, localDay } from './day.ts'

describe('localDay', () => {
  // Tests run at UTC+7 (vite.config.ts), so between midnight and 7 am the UTC day is yesterday.
  it('uses the local day, not the UTC one', () => {
    const earlyMorning = new Date(2026, 9, 26, 0, 30)
    expect(earlyMorning.toISOString().slice(0, 10)).toBe('2026-10-25')
    expect(localDay(earlyMorning)).toBe('2026-10-26')
  })

  it('pads month and day', () => {
    expect(localDay(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05')
    expect(localDay(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31')
  })

  it('moves to the next day right after midnight', () => {
    expect(localDay(new Date(2026, 9, 25, 23, 59, 59))).toBe('2026-10-25')
    expect(localDay(new Date(2026, 9, 26, 0, 0, 1))).toBe('2026-10-26')
  })
})

describe('daysBetween', () => {
  it('counts calendar days across a month and a year', () => {
    expect(daysBetween('2026-10-25', '2026-10-25')).toBe(0)
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1)
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3)
    expect(daysBetween('2026-10-25', '2026-10-20')).toBe(-5)
  })
})
