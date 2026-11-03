import { useState } from 'react'
import { Link } from 'react-router'
import { NameForm } from './NameForm.tsx'
import { RowMenu } from './RowMenu.tsx'

interface NamedItemRowProps {
  kind: 'folder' | 'file'
  name: string
  to: string
  detail?: string
  onRename: (name: string) => Promise<void>
  onDelete: () => void
}

/** One folder or file in a list: a link, plus rename in place and delete in its ⋯ menu. */
export function NamedItemRow({ kind, name, to, detail, onRename, onDelete }: NamedItemRowProps) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <li className="item">
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
        <span className="item__name">{name}</span>
        {detail && <span className="item__detail">{detail}</span>}
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
