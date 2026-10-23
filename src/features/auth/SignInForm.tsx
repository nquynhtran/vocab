import { useId, useState, type FormEvent } from 'react'
import type { SignInInput } from '../../data/auth.ts'
import { ValidationError } from '../../domain/errors.ts'
import { errorMessage } from '../../shared/errorMessage.ts'

type FieldErrors = Readonly<Record<string, readonly string[]>>

interface SignInFormProps {
  /** Throws to show the error; once it resolves, AuthGate hears the new session and moves on. */
  onSubmit: (input: SignInInput) => Promise<void>
  /** Shown above the form, e.g. why the user must sign in again. */
  notice?: string
}

export function SignInForm({ onSubmit, notice }: SignInFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const [pending, setPending] = useState(false)
  const baseId = useId()
  const ids = { email: `${baseId}-email`, password: `${baseId}-password` }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setFieldErrors({})
    setFormError(undefined)
    try {
      await onSubmit({ email, password })
      setPassword('')
    } catch (caught) {
      if (caught instanceof ValidationError) setFieldErrors(caught.fieldErrors)
      else setFormError(errorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  const emailError = fieldErrors.email?.join('. ')
  const passwordError = fieldErrors.password?.join('. ')

  return (
    <form className="sign-in-form" onSubmit={handleSubmit} noValidate>
      {notice && <p className="muted">{notice}</p>}
      <div className="field">
        <label htmlFor={ids.email}>Email</label>
        <input
          id={ids.email}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus
          aria-invalid={emailError !== undefined}
          aria-describedby={emailError ? `${ids.email}-error` : undefined}
        />
        {emailError && (
          <p id={`${ids.email}-error`} className="field-error" role="alert">
            {emailError}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor={ids.password}>Password</label>
        <input
          id={ids.password}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          aria-invalid={passwordError !== undefined}
          aria-describedby={passwordError ? `${ids.password}-error` : undefined}
        />
        {passwordError && (
          <p id={`${ids.password}-error`} className="field-error" role="alert">
            {passwordError}
          </p>
        )}
      </div>
      <button type="submit" className="button button--primary" disabled={pending}>
        Sign in
      </button>
      {formError && (
        <p className="field-error" role="alert">
          {formError}
        </p>
      )}
    </form>
  )
}
