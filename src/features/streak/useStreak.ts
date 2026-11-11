import { useCallback, useEffect } from 'react'
import { localDay } from '../../domain/day.ts'
import { UserFacingError } from '../../domain/errors.ts'
import { summarizeStreak, type StreakSummary } from '../../domain/streak/streak.ts'
import { useRepository } from '../../shared/repositoryContext.ts'
import { useAsync, type AsyncState } from '../../shared/useAsync.ts'

export interface StreakData {
  summary: StreakSummary
  /** Taken with the data: a day worked out at render time could be newer than the numbers. */
  today: string
}

export type StreakState = AsyncState<StreakData>

/**
 * The streak, loaded again whenever the user comes back: a phone left on Home overnight, or
 * answers given in another window, would otherwise keep showing old numbers. `focus` is for two
 * windows side by side, where neither ever becomes hidden. No midnight timer: Home left open and
 * in front across midnight stays stale until the next return, which is accepted (docs/streak.md).
 */
export function useStreak(): StreakState {
  const repository = useRepository()
  const load = useCallback(async () => {
    try {
      const days = await repository.listStudyDays()
      const today = localDay(new Date())
      return { summary: summarizeStreak(days, today), today }
    } catch (error) {
      // The panel shows one fixed line, so nothing else would reveal a bug here.
      if (!(error instanceof UserFacingError)) console.error(error)
      throw error
    }
  }, [repository])
  const [state, reload] = useAsync(load)

  useEffect(() => {
    function reloadWhenVisible() {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', reloadWhenVisible)
    window.addEventListener('focus', reload)
    return () => {
      document.removeEventListener('visibilitychange', reloadWhenVisible)
      window.removeEventListener('focus', reload)
    }
  }, [reload])

  return state
}
