import { Link } from 'react-router'
import { errorMessage } from './errorMessage.ts'

export function Loading() {
  return <p className="muted">Loading…</p>
}

export function LoadError({ error }: { error: unknown }) {
  return (
    <p className="field-error" role="alert">
      {errorMessage(error)}
    </p>
  )
}

/** For a page whose folder/file was deleted (possibly in another tab) or never existed. */
export function NotFound({ message }: { message: string }) {
  return (
    <section>
      <h1>{message}</h1>
      <p>
        <Link to="/">Back to your folders</Link>
      </p>
    </section>
  )
}
