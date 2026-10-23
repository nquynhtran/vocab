/** The error under a form field; `id` is what the field's aria-describedby points to. */
export function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null
  return (
    <p id={id} className="field-error" role="alert">
      {message}
    </p>
  )
}
