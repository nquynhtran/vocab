import { addDays, daysBetween } from '../day.ts'
import type { StudyDay } from '../schemas.ts'

/** Answers a day needs to count, so one answer cannot keep a streak alive (decision #8). */
export const STREAK_MIN_ANSWERS = 10

export interface StreakSummary {
  current: number
  longest: number
  /** Answers given today, whether or not they reach `STREAK_MIN_ANSWERS` yet. */
  todayAnswers: number
  /** Every day that counts, up to today. */
  studiedDays: ReadonlySet<string>
}

/**
 * Always worked out from the stored days, never saved, so changing `STREAK_MIN_ANSWERS` applies
 * to the whole history without a migration. Days after `today` (a clock set wrong, or a device
 * in another time zone) are ignored everywhere until that day comes (decision #72): counting them
 * only in `longest` would show a record that no streak ever reached.
 */
export function summarizeStreak(days: readonly StudyDay[], today: string): StreakSummary {
  const studiedDays = new Set(
    days
      .filter((day) => day.answeredCount >= STREAK_MIN_ANSWERS && day.date <= today)
      .map((day) => day.date),
  )
  return {
    current: currentStreak(studiedDays, today),
    longest: longestStreak(studiedDays),
    todayAnswers: days.find((day) => day.date === today)?.answeredCount ?? 0,
    studiedDays,
  }
}

/** Starts from yesterday while today is not done yet, so a streak is not "lost" every morning. */
function currentStreak(studiedDays: ReadonlySet<string>, today: string): number {
  let day = studiedDays.has(today) ? today : addDays(today, -1)
  let length = 0
  while (studiedDays.has(day)) {
    length += 1
    day = addDays(day, -1)
  }
  return length
}

function longestStreak(studiedDays: ReadonlySet<string>): number {
  let longest = 0
  let length = 0
  let previous: string | undefined
  for (const day of [...studiedDays].toSorted()) {
    length = previous !== undefined && daysBetween(previous, day) === 1 ? length + 1 : 1
    longest = Math.max(longest, length)
    previous = day
  }
  return longest
}
