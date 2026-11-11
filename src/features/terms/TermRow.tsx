import { useState } from 'react'
import type { Term, TermInput } from '../../domain/schemas.ts'
import { ListenWord } from '../../shared/ListenWord.tsx'
import { PartOfSpeechLabel } from '../../shared/PartOfSpeechLabel.tsx'
import { RowMenu } from '../../shared/RowMenu.tsx'
import { TermForm } from './TermForm.tsx'

interface TermRowProps {
  term: Term
  onUpdate: (input: TermInput) => Promise<void>
  onDelete: () => void
}

export function TermRow({ term, onUpdate, onDelete }: TermRowProps) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <li className="term term--editing">
        <TermForm
          submitLabel="Save"
          initial={term}
          termId={term.id}
          autoFocus
          onSubmit={async (input) => {
            await onUpdate(input)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className="term">
      <span className="term__head">
        <ListenWord word={term.word} className="term__word" />
        {term.partOfSpeech && <PartOfSpeechLabel partOfSpeech={term.partOfSpeech} />}
        {term.pronunciation && <span className="pronunciation">{term.pronunciation}</span>}
      </span>
      <span className="term__meaning">{term.meaning}</span>
      <span className="term__example">{term.example}</span>
      <div className="term__actions">
        <RowMenu
          name={term.word}
          actions={[
            {
              label: 'Edit',
              accessibleName: `Edit "${term.word}"`,
              onSelect: () => setEditing(true),
            },
            {
              label: 'Delete',
              accessibleName: `Delete "${term.word}"`,
              danger: true,
              onSelect: onDelete,
            },
          ]}
        />
      </div>
    </li>
  )
}
