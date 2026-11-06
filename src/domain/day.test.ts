import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, localDay } from './day.ts'

describe('localDay', () => {
  // Runs east of UTC (`test`) and west of it (`test:zone`). In UTC this could not fail, so the
  // first line makes sure the suite never ends up there.
  it('uses the local day, not the UTC one', () => {
    expect(new Date(2026, 9, 26).getTimezoneOffset()).not.toBe(0)
    expect(localDay(new Date(2026, 9, 26, 0, 30))).toBe('2026-10-26')
    expect(localDay(new Date(2026, 9, 26, 23, 30))).toBe('2026-10-26')
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

describe('addDays', () => {
  it('moves forward and back', () => {
    expect(addDays('2026-11-05', 1)).toBe('2026-11-06')
    expect(addDays('2026-11-05', -1)).toBe('2026-11-04')
    expect(addDays('2026-11-05', 0)).toBe('2026-11-05')
  })

  it('crosses months, years and leap days', () => {
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28')
  })

  // Only able to fail in `test:zone`: the zone of `test` has no daylight saving.
  it('does not lose or repeat a day at a daylight-saving change', () => {
    // New York moves its clocks on these days; the result must not depend on the machine's zone.
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02')
    expect(addDays('2026-11-02', -1)).toBe('2026-11-01')
  })
})
