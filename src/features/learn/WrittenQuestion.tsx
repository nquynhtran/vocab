import { useId, useState } from 'react'

/** An empty answer is allowed: it is how to say "I don't know". */
export function WrittenQuestion({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState('')
  const inputId = useId()
  return (
    <form
      className="written"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(text)
      }}
    >
      <label htmlFor={inputId}>Type the English word</label>
      {/* Phone keyboards must not "fix" the answer. */}
      <input
        id={inputId}
        value={text}
        onChange={(event) => setText(event.target.value)}
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      <button type="submit" className="button button--primary">
        Answer
      </button>
    </form>
  )
}
