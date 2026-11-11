import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon.tsx'
import { NameForm } from './NameForm.tsx'

interface ListHeaderProps {
  title: string
  /** "New folder": the button's text and the field's label. */
  createLabel: string
  /** Throws to keep the form open with the error under the field. */
  onCreate: (name: string) => Promise<void>
}

/**
 * The page title with a "+ New …" button that opens the create form beneath it (decision #86):
 * creating is rare next to opening what is already there, so the form stays out of the way.
 */
export function ListHeader({ title, createLabel, onCreate }: ListHeaderProps) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  // Only after the form closes, not on the first render: keyboard users land back where they were.
  const returnFocus = useRef(false)

  useEffect(() => {
    if (open || !returnFocus.current) return
    returnFocus.current = false
    buttonRef.current?.focus()
  }, [open])

  function close() {
    returnFocus.current = true
    setOpen(false)
  }

  return (
    <>
      <div className="list-header">
        <h1>{title}</h1>
        {!open && (
          <button
            ref={buttonRef}
            type="button"
            className="button list-header__create"
            onClick={() => setOpen(true)}
          >
            <Icon name="plus" />
            {createLabel}
          </button>
        )}
      </div>
      {open && (
        <div className="create-card">
          <NameForm
            label={createLabel}
            submitLabel="Create"
            autoFocus
            onSubmit={async (name) => {
              await onCreate(name)
              close()
            }}
            onCancel={close}
          />
        </div>
      )}
    </>
  )
}
