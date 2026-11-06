/**
 * The month calendar on Home. Works on numbers and `YYYY-MM-DD` strings, with `Date` used only as
 * UTC: local `Date` fields would shift a day in zones behind UTC (docs/streak.md).
 */
export interface CalendarMonth {
  year: number
  /** 1–12. */
  month: number
}

/** `null` pads the first and last week to seven cells. */
export type CalendarWeek = readonly (string | null)[]

const DAYS_PER_WEEK = 7

export function monthOfDay(day: string): CalendarMonth {
  return { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) }
}

/** The month `months` after `from` (before it when negative). */
export function addMonths(from: CalendarMonth, months: number): CalendarMonth {
  const total = from.year * 12 + (from.month - 1) + months
  return { year: Math.floor(total / 12), month: (((total % 12) + 12) % 12) + 1 }
}

/** The weeks of a month, Monday first (decision #71). */
export function monthWeeks({ year, month }: CalendarMonth): readonly CalendarWeek[] {
  const prefix = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const sundayFirst = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const leading = (sundayFirst + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK
  const weekCount = Math.ceil((leading + daysInMonth) / DAYS_PER_WEEK)

  return Array.from({ length: weekCount }, (_, week) =>
    Array.from({ length: DAYS_PER_WEEK }, (_, weekday) => {
      const date = week * DAYS_PER_WEEK + weekday - leading + 1
      return date < 1 || date > daysInMonth ? null : `${prefix}-${String(date).padStart(2, '0')}`
    }),
  )
}

export function monthTitle({ year, month }: CalendarMonth): string {
  return new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}
