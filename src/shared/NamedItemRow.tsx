import { useState } from 'react'
import { Link } from 'react-router'
import { Icon } from './Icon.tsx'
import { NameForm } from './NameForm.tsx'
import { RowMenu } from './RowMenu.tsx'

interface NamedItemRowProps {
  kind: 'folder' | 'file'
  name: string
  to: string
  detail?: string
  /** 0–100. Drawn as a bar under the detail, which already says the number in words. */
  progress?: number
  onRename: (name: string) => Promise<void>
  onDelete: () => void
}

/** One folder or file card: a link, plus rename in place and delete in its ⋯ menu. */
export function NamedItemRow({
  kind,
  name,
  to,
  detail,
  progress,
  onRename,
  onDelete,
}: NamedItemRowProps) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <li className="item item--editing">
        <NameForm
          label={`Rename ${kind} "${name}"`}
          submitLabel="Save"
          initialName={name}
          autoFocus
          onSubmit={async (newName) => {
            await onRename(newName)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className="item">
      <Link className="item__link" to={to}>
        <span className="item__icon">
          <Icon name={kind} />
        </span>
        <span className="item__body">
          <span className="item__name">{name}</span>
          {detail && <span className="item__detail">{detail}</span>}
          {progress !== undefined && (
            // SVG like the Learn meter: its width is an attribute, which the strict CSP allows.
            <svg className="item__progress" aria-hidden="true" focusable="false">
              <rect className="item__progress-fill" width={`${progress}%`} height="100%" rx="2" />
            </svg>
          )}
        </span>
      </Link>
      <RowMenu
        name={name}
        actions={[
          {
            label: 'Rename',
            accessibleName: `Rename ${kind} "${name}"`,
            onSelect: () => setEditing(true),
          },
          {
            label: 'Delete',
            accessibleName: `Delete ${kind} "${name}"`,
            danger: true,
            onSelect: onDelete,
          },
        ]}
      />
    </li>
  )
}
