import { Link } from 'react-router'
import { ConnectionError } from '../domain/errors.ts'
import { EmptyState } from './EmptyState.tsx'
import { errorMessage } from './errorMessage.ts'

export function Loading() {
  return <p className="muted">Loading…</p>
}

/** The first load failed, so there is nothing to show: say why and offer to load again. */
export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <EmptyState
      icon="alert"
      title="Couldn't load this page"
      alert
      actions={
        <button type="button" className="button" onClick={onRetry}>
          Try again
        </button>
      }
    >
      {/* The generic text is about writes ("may or may not have been saved"); this only read. */}
      {error instanceof ConnectionError
        ? 'Cannot reach the server. Check your connection, then try again.'
        : errorMessage(error)}
    </EmptyState>
  )
}

/** A reload failed: the page still shows what it loaded before. */
export function RefreshError({ error }: { error: unknown }) {
  if (error === undefined) return null
  return (
    <p className="field-error" role="alert">
      This page could not be refreshed and may be out of date. {errorMessage(error)}
    </p>
  )
}

/** The error of an action without a form, e.g. a failed delete. */
export function ActionError({ message }: { message: string | undefined }) {
  if (!message) return null
  return (
    <p className="field-error" role="alert">
      {message}
    </p>
  )
}

/** For a page whose folder/file was deleted (possibly in another tab) or never existed. */
export function NotFound({ message }: { message: string }) {
  return (
    <EmptyState
      icon="search"
      title={message}
      headingLevel={1}
      actions={
        <Link to="/" className="button">
          Back to your folders
        </Link>
      }
    />
  )
}
