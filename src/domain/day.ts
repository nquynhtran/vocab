/**
 * Local calendar days (`YYYY-MM-DD`), shared by Learn and the streak (docs/streak.md).
 * Built from the device's local fields, never `toISOString()`: that is UTC, so at UTC+7 an answer
 * given between midnight and 7 am would count for the day before.
 */
export function localDay(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const date = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${date}`
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Whole calendar days from `from` to `to` (both `YYYY-MM-DD`), negative when `to` is earlier.
 * Computed on UTC midnights so a daylight-saving change cannot make a day 23 or 25 hours long.
 */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / MS_PER_DAY)
}
