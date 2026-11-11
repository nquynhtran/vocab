import type { ReactNode } from 'react'
import { EmptyState } from './EmptyState.tsx'
import { Icon, type IconName } from './Icon.tsx'
import { NameForm } from './NameForm.tsx'
import { useRevealedForm } from './useRevealedForm.ts'

interface ListHeaderProps {
  title: string
  /** "New folder": the button's text and the field's label. */
  createLabel: string
  /** Throws to keep the form open with the error under the field. */
  onCreate: (name: string) => Promise<void>
  /** Given once the list has loaded empty: shown under the header while the form is closed. */
  empty?: EmptyHint
}

interface EmptyHint {
  icon: IconName
  title: string
  text: string
  /** Opens the same form as the header button; a name of its own, so the two can be told apart. */
  actionLabel: string
  /** A second, quieter way out, e.g. restoring a backup. */
  extra?: ReactNode
}

/**
 * The page title with a "+ New …" button that opens the create form beneath it (decision #86):
 * creating is rare next to opening what is already there, so the form stays out of the way.
 */
export function ListHeader({ title, createLabel, onCreate, empty }: ListHeaderProps) {
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
      {/*
        The header button stays even then: closing the form puts focus back on it, and the list
        may still be empty at that moment (the reload after a create is not awaited).
      */}
      {empty && !form.open && (
        <EmptyState
          icon={empty.icon}
          title={empty.title}
          actions={
            <>
              <button type="button" className="button button--primary" onClick={form.show}>
                {empty.actionLabel}
              </button>
              {empty.extra}
            </>
          }
        >
          {empty.text}
        </EmptyState>
      )}
    </>
  )
}
