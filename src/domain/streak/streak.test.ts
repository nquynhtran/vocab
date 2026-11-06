import { describe, expect, it } from 'vitest'
import type { StudyDay } from '../schemas.ts'
import { STREAK_MIN_ANSWERS, summarizeStreak } from './streak.ts'

const TODAY = '2026-11-05'

/** Days that reach the minimum. */
const studied = (...dates: string[]): StudyDay[] =>
  dates.map((date) => ({ date, answeredCount: STREAK_MIN_ANSWERS }))

function streak(days: readonly StudyDay[], today = TODAY) {
  const { current, longest } = summarizeStreak(days, today)
  return { current, longest }
}

describe('summarizeStreak', () => {
  it('is all zero when nothing was ever studied', () => {
    expect(summarizeStreak([], TODAY)).toStrictEqual({
      current: 0,
      longest: 0,
      todayAnswers: 0,
      studiedDays: new Set(),
    })
  })

  it('counts a day studied only today', () => {
    expect(streak(studied(TODAY))).toStrictEqual({ current: 1, longest: 1 })
  })

  it('keeps the streak while today is not done yet', () => {
    expect(streak(studied('2026-11-03', '2026-11-04'))).toStrictEqual({ current: 2, longest: 2 })
  })

  it('keeps the streak when today has some answers but not enough', () => {
    const days = [...studied('2026-11-04'), { date: TODAY, answeredCount: 4 }]
    expect(streak(days)).toStrictEqual({ current: 1, longest: 1 })
  })

  it('includes today once it reaches the minimum', () => {
    expect(streak(studied('2026-11-04', TODAY))).toStrictEqual({ current: 2, longest: 2 })
  })

  it('breaks at a skipped day', () => {
    expect(streak(studied('2026-11-01', '2026-11-02', '2026-11-04', TODAY))).toStrictEqual({
      current: 2,
      longest: 2,
    })
  })

  it('is zero when neither today nor yesterday counts', () => {
    expect(streak(studied('2026-11-02', '2026-11-03'))).toStrictEqual({ current: 0, longest: 2 })
  })

  it('needs exactly the minimum: one answer fewer does not count', () => {
    const below = STREAK_MIN_ANSWERS - 1
    expect(streak([{ date: TODAY, answeredCount: below }]).current).toBe(0)
    expect(streak([{ date: TODAY, answeredCount: STREAK_MIN_ANSWERS }]).current).toBe(1)
  })

  it('does not count a day with no answers', () => {
    expect(streak([{ date: TODAY, answeredCount: 0 }])).toStrictEqual({ current: 0, longest: 0 })
  })

  it('stops at yesterday when today counts and yesterday fell short', () => {
    const days = [
      ...studied('2026-11-03', TODAY),
      { date: '2026-11-04', answeredCount: STREAK_MIN_ANSWERS - 1 },
    ]
    expect(streak(days)).toStrictEqual({ current: 1, longest: 1 })
  })

  it('loses the streak when yesterday fell short and today has no answers yet', () => {
    const days = [
      ...studied('2026-11-02', '2026-11-03'),
      { date: '2026-11-04', answeredCount: STREAK_MIN_ANSWERS - 1 },
    ]
    expect(streak(days)).toStrictEqual({ current: 0, longest: 2 })
  })

  it('runs across the end of a month', () => {
    expect(streak(studied('2026-10-30', '2026-10-31', '2026-11-01'), '2026-11-01')).toStrictEqual({
      current: 3,
      longest: 3,
    })
  })

  it('runs across the end of a year', () => {
    expect(streak(studied('2026-12-31', '2027-01-01'), '2027-01-01')).toStrictEqual({
      current: 2,
      longest: 2,
    })
  })

  it('runs across 29 February in a leap year', () => {
    expect(streak(studied('2028-02-28', '2028-02-29', '2028-03-01'), '2028-03-01')).toStrictEqual({
      current: 3,
      longest: 3,
    })
  })

  it('breaks at 1 March when 28 February is followed by nothing in a leap year', () => {
    // 29 Feb exists in 2028, so 28 Feb and 1 Mar are not consecutive there.
    expect(streak(studied('2028-02-28', '2028-03-01'), '2028-03-01')).toStrictEqual({
      current: 1,
      longest: 1,
    })
  })

  it('accepts days in any order', () => {
    expect(streak(studied(TODAY, '2026-11-03', '2026-11-04'))).toStrictEqual({
      current: 3,
      longest: 3,
    })
    expect(streak(studied('2026-11-02', '2026-10-30', '2026-10-31', '2026-11-01'))).toStrictEqual({
      current: 0,
      longest: 4,
    })
  })

  it('keeps a record longer than the current streak', () => {
    const days = studied('2026-10-01', '2026-10-02', '2026-10-03', '2026-11-04', TODAY)
    expect(streak(days)).toStrictEqual({ current: 2, longest: 3 })
  })

  it('reports a record equal to the current streak', () => {
    const days = studied('2026-10-01', '2026-10-02', '2026-11-04', TODAY)
    expect(streak(days)).toStrictEqual({ current: 2, longest: 2 })
  })

  describe('days after today', () => {
    it('counts nothing when only future days exist', () => {
      expect(summarizeStreak(studied('2026-11-06', '2026-11-07'), TODAY)).toStrictEqual({
        current: 0,
        longest: 0,
        todayAnswers: 0,
        studiedDays: new Set(),
      })
    })

    it('does not lengthen the current streak or the record', () => {
      // Counted, the future day would make the record 3 while the streak stays 2.
      expect(streak(studied('2026-11-04', TODAY, '2026-11-06'))).toStrictEqual({
        current: 2,
        longest: 2,
      })
    })

    it('is not marked as studied', () => {
      const { studiedDays } = summarizeStreak(studied(TODAY, '2026-11-06'), TODAY)
      expect(studiedDays).toStrictEqual(new Set([TODAY]))
    })

    it('counts once that day comes', () => {
      expect(streak(studied('2026-11-04', TODAY, '2026-11-06'), '2026-11-06')).toStrictEqual({
        current: 3,
        longest: 3,
      })
    })
  })

  describe('todayAnswers', () => {
    it("is today's count, not the latest day's", () => {
      const days = [
        { date: '2026-11-04', answeredCount: 25 },
        { date: TODAY, answeredCount: 4 },
        { date: '2026-11-06', answeredCount: 30 },
      ]
      expect(summarizeStreak(days, TODAY).todayAnswers).toBe(4)
    })

    it('is zero when only earlier days have answers', () => {
      expect(summarizeStreak(studied('2026-11-04'), TODAY).todayAnswers).toBe(0)
    })
  })

  it('marks only the days that count', () => {
    const days = [
      { date: '2026-11-03', answeredCount: STREAK_MIN_ANSWERS - 1 },
      { date: '2026-11-04', answeredCount: STREAK_MIN_ANSWERS },
    ]
    expect(summarizeStreak(days, TODAY).studiedDays).toStrictEqual(new Set(['2026-11-04']))
  })
})
