import { daysBetween, localDay } from '../../domain/day.ts'

/** In calendar days on this device; a clock set back counts as today. */
export function lastStudied(savedAt: string, now: Date): string {
  const days = daysBetween(localDay(new Date(savedAt)), localDay(now))
  if (days <= 0) return 'today'
  return days === 1 ? 'yesterday' : `${days} days ago`
}
