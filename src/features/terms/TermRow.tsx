import { useState } from 'react'
import type { Term, TermInput } from '../../domain/schemas.ts'
import { ListenButton } from './ListenButton.tsx'
import { PART_OF_SPEECH_ABBREVIATIONS } from './partOfSpeech.ts'
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
        <span className="term__word">{term.word}</span>
        {term.partOfSpeech && (
          <abbr className="term__pos" title={term.partOfSpeech}>
            {PART_OF_SPEECH_ABBREVIATIONS[term.partOfSpeech]}
          </abbr>
        )}
        <ListenButton text={term.word} />
      </span>
      <span className="term__meaning">{term.meaning}</span>
      <span className="term__example">{term.example}</span>
      <div className="term__actions">
        <button
          type="button"
          className="button"
          aria-label={`Edit "${term.word}"`}
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
        <button
          type="button"
          className="button button--danger"
          aria-label={`Delete "${term.word}"`}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </li>
  )
}
