import { useCallback, useEffect, useId, useState, type ReactNode } from 'react'
import type { Auth } from '../data/auth.ts'
import { ConnectionError } from '../domain/errors.ts'
import { SignInForm } from '../features/auth/SignInForm.tsx'
import { errorMessage } from '../shared/errorMessage.ts'
import { Loading } from '../shared/PageStatus.tsx'
import { SignOutContext } from '../shared/signOutContext.ts'

const OFFLINE_AT_START = 'Cannot reach the server. Check your connection and try again.'

interface AuthGateProps {
  auth: Auth
  /** Resolves `true` when the cloud requires a newer client (decision #34). */
  isOutdated: () => Promise<boolean>
  /** Replaces the app: its code is too old to keep writing. */
  onOutdated: () => void
  children: ReactNode
}

/**
 * Shows the app only to a signed-in user on a client that is new enough (docs/cloud-sync.md),
 * checked again after every sign-in. Once shown, the app stays mounted when the session is lost
 * (401, revoked, signed out in another tab): it is hidden and made inert under a sign-in dialog,
 * so whatever the user was typing survives signing in again (decision #43). Signing out with
 * the button unmounts it.
 */
export function AuthGate({ auth, isOutdated, onOutdated, children }: AuthGateProps) {
  // undefined until supabase-js has read the stored session.
  const [userId, setUserId] = useState<string | null>()
  // The user of the current session once the version check passed; reset by every sign-out.
  const [checkedUserId, setCheckedUserId] = useState<string>()
  // Whose data the mounted app shows; undefined while no app is mounted.
  const [appUserId, setAppUserId] = useState<string>()
  const [checkError, setCheckError] = useState<unknown>()
  const [attempt, setAttempt] = useState(0)
  const [signingOut, setSigningOut] = useState(false)
  const dialogTitleId = useId()

  useEffect(
    () =>
      auth.subscribe((next) => {
        setUserId(next)
        // A new session gets a new check; an error from the previous one no longer applies.
        if (next === null) setCheckedUserId(undefined)
        setCheckError(undefined)
      }),
    [auth],
  )

  // Checked before the app appears or comes back, so outdated code never gets to write.
  useEffect(() => {
    if (typeof userId !== 'string' || userId === checkedUserId || signingOut) return
    let current = true
    isOutdated().then(
      (outdated) => {
        if (!current) return
        if (outdated) {
          onOutdated()
          return
        }
        if (appUserId !== undefined && appUserId !== userId) {
          // The new user must not land on a page of the previous one.
          window.location.hash = '#/'
        }
        setCheckedUserId(userId)
        setAppUserId(userId)
      },
      (error: unknown) => current && setCheckError(error),
    )
    return () => {
      current = false
    }
  }, [userId, checkedUserId, appUserId, signingOut, attempt, isOutdated, onOutdated])

  useEffect(() => {
    if (appUserId === undefined) return
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
  }, [appUserId, isOutdated, onOutdated])

  const signOut = useCallback(async () => {
    setSigningOut(true)
    try {
      await auth.signOut()
    } finally {
      // Also on failure: supabase-js drops the local session even when the server could not be
      // told. Should a session survive, it is checked again and gets a fresh app.
      setAppUserId(undefined)
      setCheckedUserId(undefined)
      setSigningOut(false)
      window.location.hash = '#/'
    }
  }, [auth])

  function retry() {
    setCheckError(undefined)
    setAttempt((n) => n + 1)
  }

  let overlay: ReactNode = null
  if (userId === undefined || signingOut) {
    overlay = <Loading />
  } else if (userId === null) {
    overlay = (
      <section>
        <h1 id={dialogTitleId}>Sign in</h1>
        <SignInForm
          onSubmit={(input) => auth.signIn(input)}
          notice={
            appUserId === undefined
              ? undefined
              : 'You were signed out. Sign in again with the same account to keep what you typed.'
          }
        />
      </section>
    )
  } else if (checkError !== undefined) {
    overlay = (
      <section>
        <p className="field-error" role="alert">
          {checkError instanceof ConnectionError ? OFFLINE_AT_START : errorMessage(checkError)}
        </p>
        <button type="button" className="button" onClick={retry}>
          Retry
        </button>
      </section>
    )
  } else if (userId !== checkedUserId) {
    overlay = <Loading />
  }

  if (appUserId === undefined || signingOut) {
    return <main className="page">{overlay}</main>
  }
  return (
    <SignOutContext value={signOut}>
      {/* A new user gets a fresh app: nothing from the previous account stays on screen. */}
      <div key={appUserId} inert={overlay !== null}>
        {children}
      </div>
      {overlay && (
        <div className="overlay">
          <div
            className="overlay__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={userId === null ? dialogTitleId : undefined}
            aria-label={userId === null ? undefined : 'Signing in'}
          >
            {overlay}
          </div>
        </div>
      )}
    </SignOutContext>
  )
}
