import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openTestRepository, renderAppAt, seedFile } from '../../app/testApp.tsx'
import { ConnectionError } from '../../domain/errors.ts'
import { NOTES_MAX_LENGTH } from '../../domain/schemas.ts'

const draftKey = (fileId: string) => `vocab-notes-draft:${fileId}`

async function openFilePage() {
  const repository = openTestRepository()
  const { file } = await seedFile(repository)
  const view = renderAppAt(`/files/${file.id}`, repository)
  await screen.findByRole('heading', { name: 'Unit 1' })
  return { repository, file, ...view }
}

function notesBox() {
  return screen.getByRole('textbox', { name: 'Notes' })
}

function typeNotes(text: string) {
  fireEvent.change(notesBox(), { target: { value: text } })
}

beforeEach(() => localStorage.clear())

afterEach(() => {
  vi.restoreAllMocks()
  window.location.hash = ''
})

describe('file notes', () => {
  it('starts collapsed above the term form, then adds notes keeping their line breaks', async () => {
    const { repository, file } = await openFilePage()
    const details = screen.getByText('Notes', { selector: 'summary' }).closest('details')!
    expect(details.open).toBe(false)
    // Above the form, so a long word list never pushes it out of reach.
    expect(
      details.compareDocumentPosition(screen.getByLabelText('Term')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Add notes' }))
    typeNotes('Reading:\r\n\r\n  The river runs.\n')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const text = await screen.findByText(/The river runs\./, { selector: '.notes__text' })
    expect(text.textContent).toBe('Reading:\n\n  The river runs.')
    expect(screen.getByText('Notes', { selector: 'summary' })).toHaveTextContent(
      'Notes · 27 characters',
    )
    expect((await repository.getFile(file.id))?.notes).toBe('Reading:\n\n  The river runs.')
    expect(localStorage.getItem(draftKey(file.id))).toBeNull()
  })

  it('counts characters with fixed English digits, and flags notes that are too long', async () => {
    await openFilePage()
    fireEvent.click(screen.getByRole('button', { name: 'Add notes' }))
    typeNotes('a'.repeat(1234))
    expect(screen.getByText('1,234 / 10,000')).toBeInTheDocument()

    typeNotes('a'.repeat(NOTES_MAX_LENGTH + 2))
    expect(screen.getByText('10,002 / 10,000 · 2 characters too many')).toBeInTheDocument()
    expect(notesBox()).toHaveAttribute('aria-invalid', 'true')
    // No maxLength: a long paste is never cut silently.
    expect(notesBox()).not.toHaveAttribute('maxlength')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Notes must be at most 10000 characters',
    )
    expect(notesBox()).toHaveValue('a'.repeat(NOTES_MAX_LENGTH + 2))
  })

  it('cancels only with the Cancel button, discarding the draft', async () => {
    const { file } = await openFilePage()
    fireEvent.click(screen.getByRole('button', { name: 'Add notes' }))
    typeNotes('Half a reading')
    expect(localStorage.getItem(draftKey(file.id))).toBe('{"text":"Half a reading"}')

    fireEvent.keyDown(notesBox(), { key: 'Escape' })
    expect(notesBox()).toHaveValue('Half a reading')

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('No notes yet.')).toBeInTheDocument()
    expect(localStorage.getItem(draftKey(file.id))).toBeNull()
  })

  it('restores an unsaved draft after the page is reloaded, e.g. by iOS', async () => {
    const { repository, file, unmount } = await openFilePage()
    await repository.updateFileNotes(file.id, { notes: 'Saved before' })
    fireEvent.click(await screen.findByRole('button', { name: 'Add notes' }))
    typeNotes('Saved before, and more typed')
    unmount()

    renderAppAt(`/files/${file.id}`, repository)

    expect(await screen.findByText('Unsaved draft restored.')).toBeInTheDocument()
    // Effects run after that render: check once they did, so syncing to `file` would show.
    await act(async () => {})
    expect(notesBox()).toHaveValue('Saved before, and more typed')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Saved before, and more typed', { selector: '.notes__text' })
    expect(localStorage.getItem(draftKey(file.id))).toBeNull()
  })

  it('keeps the text and the draft when saving fails, even after the page reloads', async () => {
    const { repository, file } = await openFilePage()
    vi.spyOn(repository, 'updateFileNotes').mockRejectedValueOnce(new ConnectionError())
    const reads = vi.spyOn(repository, 'getFile')
    fireEvent.click(screen.getByRole('button', { name: 'Add notes' }))
    typeNotes('A long reading')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/connection|internet|network/i)
    // Every write reloads the page; that new `file` must not replace what was typed.
    await waitFor(() => expect(reads).toHaveBeenCalled())
    await act(async () => {})
    expect(notesBox()).toHaveValue('A long reading')
    expect(localStorage.getItem(draftKey(file.id))).toBe('{"text":"A long reading"}')
  })

  it('still edits notes when storage cannot be used', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    const { repository, file } = await openFilePage()
    fireEvent.click(screen.getByRole('button', { name: 'Add notes' }))
    typeNotes('Notes')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Notes', { selector: '.notes__text' })
    expect((await repository.getFile(file.id))?.notes).toBe('Notes')
  })

  it('drops a draft it cannot read', async () => {
    const repository = openTestRepository()
    const { file } = await seedFile(repository)
    localStorage.setItem(draftKey(file.id), '{"text": 3}')
    renderAppAt(`/files/${file.id}`, repository)
    expect(await screen.findByRole('button', { name: 'Add notes' })).toBeInTheDocument()
    expect(localStorage.getItem(draftKey(file.id))).toBeNull()
  })
})
