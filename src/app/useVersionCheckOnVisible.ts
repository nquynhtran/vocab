import { useEffect } from 'react'

/**
 * While the app is shown, checks the client version again each time the tab becomes visible:
 * a tab or phone left open for days would otherwise keep running old code (decision #34).
 */
export function useVersionCheckOnVisible(
  enabled: boolean,
  isOutdated: () => Promise<boolean>,
  onOutdated: () => void,
) {
  useEffect(() => {
    if (!enabled) return
    function checkWhenVisible() {
      if (document.visibilityState !== 'visible') return
      // A failure here is not worth an alert: the user's next action reports it anyway.
      isOutdated().then(
        (outdated) => outdated && onOutdated(),
        () => undefined,
      )
    }
    document.addEventListener('visibilitychange', checkWhenVisible)
    return () => document.removeEventListener('visibilitychange', checkWhenVisible)
  }, [enabled, isOutdated, onOutdated])
}
