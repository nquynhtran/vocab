import type { ReactNode, RefObject } from 'react'
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
      <RevealHeader
        title={title}
        level={1}
        buttonLabel={createLabel}
        open={form.open}
        onShow={form.show}
        buttonRef={buttonRef}
      />
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

/**
 * A title with a "+ …" button that steps aside while its form is open (useRevealedForm): the
 * header of Home, a folder and the term list of a file.
 */
export function RevealHeader({
  title,
  level,
  buttonLabel,
  open,
  onShow,
  buttonRef,
}: {
  title: string
  /** 1 for the page title, 2 for a section of the page. */
  level: 1 | 2
  buttonLabel: string
  open: boolean
  onShow: () => void
  buttonRef: RefObject<HTMLButtonElement | null>
}) {
  const Heading = level === 1 ? 'h1' : 'h2'
  return (
    <div className="list-header">
      <Heading>{title}</Heading>
      {!open && (
        <button
          ref={buttonRef}
          type="button"
          className="button list-header__create"
          onClick={onShow}
        >
          <Icon name="plus" />
          {buttonLabel}
        </button>
      )}
    </div>
  )
}
