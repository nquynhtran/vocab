import { describe, expect, it } from 'vitest'
import { addMonths, monthOfDay, monthTitle, monthWeeks } from './calendar.ts'

describe('monthOfDay', () => {
  it('reads the year and month of a day', () => {
    expect(monthOfDay('2026-11-05')).toStrictEqual({ year: 2026, month: 11 })
    expect(monthOfDay('2027-01-31')).toStrictEqual({ year: 2027, month: 1 })
  })
})

describe('addMonths', () => {
  it('moves within a year', () => {
    expect(addMonths({ year: 2026, month: 11 }, -1)).toStrictEqual({ year: 2026, month: 10 })
    expect(addMonths({ year: 2026, month: 11 }, 1)).toStrictEqual({ year: 2026, month: 12 })
    expect(addMonths({ year: 2026, month: 11 }, 0)).toStrictEqual({ year: 2026, month: 11 })
  })

  it('crosses a year in both directions', () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toStrictEqual({ year: 2027, month: 1 })
    expect(addMonths({ year: 2027, month: 1 }, -1)).toStrictEqual({ year: 2026, month: 12 })
  })

  it('moves by many months', () => {
    expect(addMonths({ year: 2026, month: 11 }, -23)).toStrictEqual({ year: 2024, month: 12 })
    expect(addMonths({ year: 2026, month: 11 }, -24)).toStrictEqual({ year: 2024, month: 11 })
  })
})

describe('monthWeeks', () => {
  const cellCount = (weeks: ReturnType<typeof monthWeeks>) => weeks.flat().length

  it('starts each week on Monday', () => {
    // 1 November 2026 is a Sunday, so it sits alone at the end of the first week.
    const weeks = monthWeeks({ year: 2026, month: 11 })
    expect(weeks[0]).toStrictEqual([null, null, null, null, null, null, '2026-11-01'])
    expect(weeks[1]?.[0]).toBe('2026-11-02')
    expect(weeks[5]).toStrictEqual(['2026-11-30', null, null, null, null, null, null])
  })

  it('has no leading blanks when the month starts on a Monday', () => {
    // 1 June 2026 is a Monday.
    const weeks = monthWeeks({ year: 2026, month: 6 })
    expect(weeks[0]?.[0]).toBe('2026-06-01')
    expect(weeks).toHaveLength(5)
  })

  it('has four rows for a February that fills them exactly', () => {
    // 1 February 2027 is a Monday and 2027 is not a leap year.
    const weeks = monthWeeks({ year: 2027, month: 2 })
    expect(weeks).toHaveLength(4)
    expect(weeks[3]?.[6]).toBe('2027-02-28')
  })

  it('has five rows for an ordinary month', () => {
    expect(monthWeeks({ year: 2026, month: 10 })).toHaveLength(5)
  })

  it('has six rows when the month needs them', () => {
    expect(monthWeeks({ year: 2026, month: 11 })).toHaveLength(6)
  })

  it('includes 29 February only in a leap year', () => {
    expect(monthWeeks({ year: 2028, month: 2 }).flat()).toContain('2028-02-29')
    expect(monthWeeks({ year: 2027, month: 2 }).flat()).not.toContain('2027-02-29')
  })

  it('lists every day once, in order, and only full weeks', () => {
    const weeks = monthWeeks({ year: 2026, month: 1 })
    expect(cellCount(weeks) % 7).toBe(0)
    expect(weeks.flat().filter((day) => day !== null)).toStrictEqual(
      Array.from({ length: 31 }, (_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`),
    )
  })
})

describe('monthTitle', () => {
  it('names the month in English', () => {
    expect(monthTitle({ year: 2026, month: 11 })).toBe('November 2026')
    expect(monthTitle({ year: 2027, month: 1 })).toBe('January 2027')
  })
})
