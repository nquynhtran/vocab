import { InvalidStoredDataError } from '../../domain/errors.ts'
import { STREAK_MIN_ANSWERS, type StreakSummary } from '../../domain/streak/streak.ts'
import { StreakCalendar } from './StreakCalendar.tsx'
import type { StreakState } from './useStreak.ts'

function streakLine({ current, longest }: StreakSummary): string {
  const best = longest > 0 ? ` · Best ${longest}` : ''
  return current > 0 ? `🔥 ${current}-day streak${best}` : `Start a streak today${best}`
}

function todayLine({ todayAnswers }: StreakSummary): string {
  return todayAnswers >= STREAK_MIN_ANSWERS
    ? `Today: ${todayAnswers} answers ✓`
    : `Today: ${todayAnswers}/${STREAK_MIN_ANSWERS} answers`
}

/** Bad stored data says where it is and how to fix it; nothing else on the page would tell. */
function problemDetail(error: unknown): string {
  return error instanceof InvalidStoredDataError ? ` ${error.message}` : ''
}

/**
 * Problems here are one quiet line, not an alert: the user did not ask for this load, and when the
 * connection is down the folder list already reports it (decision #73).
 */
export function StreakPanel({ state }: { state: StreakState }) {
  if (state.status === 'loading') return <div className="streak streak--loading" />
  if (state.status === 'error') {
    return (
      <section className="streak" aria-label="Study streak">
        <p className="muted streak__problem">
          Streak could not be loaded.{problemDetail(state.error)}
        </p>
      </section>
    )
  }

  const { summary, today } = state.data
  return (
    <section className="streak" aria-label="Study streak">
      <p className="streak__line">{streakLine(summary)}</p>
      <p className="muted streak__today">{todayLine(summary)}</p>
      {state.refreshError !== undefined && (
        <p className="muted streak__problem">
          Streak may be out of date.{problemDetail(state.refreshError)}
        </p>
      )}
      <StreakCalendar studiedDays={summary.studiedDays} today={today} />
    </section>
  )
}
