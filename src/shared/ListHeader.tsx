import { Icon } from './Icon.tsx'
import { NameForm } from './NameForm.tsx'
import { useRevealedForm } from './useRevealedForm.ts'

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
  const { buttonRef, ...form } = useRevealedForm()

  return (
    <>
      <div className="list-header">
        <h1>{title}</h1>
        {!form.open && (
          <button
            ref={buttonRef}
            type="button"
            className="button list-header__create"
            onClick={form.show}
          >
            <Icon name="plus" />
            {createLabel}
          </button>
        )}
      </div>
      {form.open && (
        <div className="create-card">
          <NameForm
            label={createLabel}
            submitLabel="Create"
            autoFocus={form.autoFocus}
            onSubmit={async (name) => {
              await onCreate(name)
              form.hide()
            }}
            onCancel={form.hide}
          />
        </div>
      )}
    </>
  )
}
