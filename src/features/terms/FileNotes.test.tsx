import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openTestRepository, renderAppAt, seedFile } from '../../app/testApp.tsx'
import { ConnectionError, SessionExpiredError } from '../../domain/errors.ts'
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

/** Pressing Add/Edit reads the latest notes first, so the box comes a moment later. */
async function startEditing(button = 'Add notes') {
  fireEvent.click(await screen.findByRole('button', { name: button }))
  await screen.findByRole('textbox', { name: 'Notes' })
}

/** An empty file also opens the term form, which has its own Cancel. */
function notesCancelButton() {
  const notes = screen.getByText(/^Notes/, { selector: 'summary' }).closest('details')!
  return within(notes).getByRole('button', { name: 'Cancel' })
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

    await startEditing()
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
    await startEditing()
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
    await startEditing()
    typeNotes('Half a reading')
    expect(JSON.parse(localStorage.getItem(draftKey(file.id))!)).toEqual({
      text: 'Half a reading',
      base: '',
    })

    fireEvent.keyDown(notesBox(), { key: 'Escape' })
    expect(notesBox()).toHaveValue('Half a reading')

    fireEvent.click(notesCancelButton())
    expect(screen.getByText('No notes yet.')).toBeInTheDocument()
    expect(localStorage.getItem(draftKey(file.id))).toBeNull()
  })

  it('restores an unsaved draft after the page is reloaded, e.g. by iOS', async () => {
    const { repository, file, unmount } = await openFilePage()
    await repository.updateFileNotes(file.id, { notes: 'Saved before' })
    // This page does not know about them yet: editing must start from what is stored.
    await startEditing()
    expect(notesBox()).toHaveValue('Saved before')
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
    await startEditing()
    typeNotes('A long reading')
    await repository.renameFile(file.id, { name: 'Renamed' })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/connection|internet|network/i)
    // Every write reloads the page; that new `file` must not replace what was typed. The new
    // name proves the reload is done, and effects run with it.
    await screen.findByRole('heading', { name: 'Renamed' })
    await act(async () => {})
    expect(notesBox()).toHaveValue('A long reading')
    expect(JSON.parse(localStorage.getItem(draftKey(file.id))!)).toEqual({
      text: 'A long reading',
      base: '',
    })
  })

  it('shows the saved notes even when the reload after saving fails, and edits from them', async () => {
    const { repository, file } = await openFilePage()
    const read = repository.getFile.bind(repository)
    const getFile = vi.spyOn(repository, 'getFile')
    const update = repository.updateFileNotes.bind(repository)
    vi.spyOn(repository, 'updateFileNotes').mockImplementation(async (...args) => {
      // Only the reload that follows the save fails, not the check before it.
      getFile.mockRejectedValueOnce(new ConnectionError())
      return update(...args)
    })
    await startEditing()
    typeNotes('New notes')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText(/could not be refreshed/i)).toBeInTheDocument()
    expect(screen.getByText('New notes', { selector: '.notes__text' })).toBeInTheDocument()
    getFile.mockRejectedValueOnce(new ConnectionError())
    await startEditing('Edit notes')
    expect(notesBox()).toHaveValue('New notes')
    expect((await read(file.id))?.notes).toBe('New notes')
  })

  it('locks the box while saving, so nothing typed meanwhile is dropped', async () => {
    const { repository } = await openFilePage()
    let finishSave = () => {}
    const update = repository.updateFileNotes.bind(repository)
    const save = vi.spyOn(repository, 'updateFileNotes').mockImplementation(
      (...args) =>
        new Promise((resolve) => {
          finishSave = () => resolve(update(...args))
        }),
    )
    await startEditing()
    typeNotes('Notes')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(notesBox()).toHaveAttribute('readonly')
    await waitFor(() => expect(save).toHaveBeenCalled())
    expect(notesBox()).toHaveAttribute('readonly')
    await act(async () => finishSave())
    await screen.findByText('Notes', { selector: '.notes__text' })
  })

  it('keeps the text when the session expired while saving', async () => {
    const { repository, file } = await openFilePage()
    vi.spyOn(repository, 'updateFileNotes').mockRejectedValueOnce(new SessionExpiredError())
    await startEditing()
    typeNotes('A long reading')
    await repository.renameFile(file.id, { name: 'Renamed' })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('alert')
    await screen.findByRole('heading', { name: 'Renamed' })
    await act(async () => {})
    expect(notesBox()).toHaveValue('A long reading')
  })

  describe('when the saved notes changed elsewhere (#69)', () => {
    it('warns on Save instead of overwriting, then Save anyway replaces them', async () => {
      const { repository, file } = await openFilePage()
      await startEditing()
      typeNotes('From the phone')
      await repository.updateFileNotes(file.id, { notes: 'From the computer' })

      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      const warning = await screen.findByRole('alert')
      expect(warning).toHaveTextContent(/changed after you started editing/)
      expect(within(warning).getByText('From the computer')).toBeInTheDocument()
      expect((await repository.getFile(file.id))?.notes).toBe('From the computer')
      expect(notesBox()).toHaveValue('From the phone')

      fireEvent.click(screen.getByRole('button', { name: 'Save anyway' }))
      await screen.findByText('From the phone', { selector: '.notes__text' })
      expect((await repository.getFile(file.id))?.notes).toBe('From the phone')
    })

    it('shows the newer notes after Cancel, not the ones from before', async () => {
      const { repository, file } = await openFilePage()
      await startEditing()
      typeNotes('From the phone')
      await repository.updateFileNotes(file.id, { notes: 'From the computer' })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      await screen.findByRole('alert')

      fireEvent.click(notesCancelButton())

      expect(
        screen.getByText('From the computer', { selector: '.notes__text' }),
      ).toBeInTheDocument()
      expect(screen.getByText('Notes', { selector: 'summary' })).toHaveTextContent('17 characters')
    })

    it('warns when they were emptied elsewhere', async () => {
      const { repository, file } = await openFilePage()
      await repository.updateFileNotes(file.id, { notes: 'Before' })
      await startEditing()
      typeNotes('From the phone')
      await repository.updateFileNotes(file.id, { notes: '' })

      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(within(await screen.findByRole('alert')).getByText('(empty)')).toBeInTheDocument()
      expect((await repository.getFile(file.id))?.notes).toBeUndefined()
    })

    it('warns again when they changed once more after the first warning', async () => {
      const { repository, file } = await openFilePage()
      await startEditing()
      typeNotes('From the phone')
      await repository.updateFileNotes(file.id, { notes: 'First' })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      await screen.findByRole('alert')
      await repository.updateFileNotes(file.id, { notes: 'Second' })

      fireEvent.click(screen.getByRole('button', { name: 'Save anyway' }))

      await within(await screen.findByRole('alert')).findByText('Second')
      expect((await repository.getFile(file.id))?.notes).toBe('Second')
    })

    it('warns when restoring a draft started from older notes, and across another reload', async () => {
      const repository = openTestRepository()
      const { file } = await seedFile(repository)
      await repository.updateFileNotes(file.id, { notes: 'Newer' })
      localStorage.setItem(draftKey(file.id), JSON.stringify({ text: 'Draft', base: 'Older' }))
      const { unmount } = renderAppAt(`/files/${file.id}`, repository)

      expect(await screen.findByRole('alert')).toHaveTextContent(/changed after you started/)
      expect(notesBox()).toHaveValue('Draft')
      typeNotes('Draft, longer')
      unmount()

      renderAppAt(`/files/${file.id}`, repository)
      expect(await screen.findByRole('alert')).toHaveTextContent(/changed after you started/)
      expect(notesBox()).toHaveValue('Draft, longer')
      fireEvent.click(notesCancelButton())
      expect(screen.getByText('Newer', { selector: '.notes__text' })).toBeInTheDocument()
    })

    it('does not warn when a save arrived but its answer was lost', async () => {
      const { repository, file } = await openFilePage()
      const update = repository.updateFileNotes.bind(repository)
      vi.spyOn(repository, 'updateFileNotes').mockImplementationOnce(async (...args) => {
        await update(...args)
        throw new ConnectionError()
      })
      await startEditing()
      typeNotes(' Notes ')
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      await screen.findByRole('alert')

      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      // The warning also shows the saved notes: what proves no warning is the box closing.
      await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Notes' })).toBeNull())
      expect(screen.queryByRole('alert')).toBeNull()
      expect((await repository.getFile(file.id))?.notes).toBe('Notes')
    })

    it('does not warn when restoring a draft whose text is what got saved', async () => {
      const repository = openTestRepository()
      const { file } = await seedFile(repository)
      await repository.updateFileNotes(file.id, { notes: 'Notes' })
      localStorage.setItem(draftKey(file.id), JSON.stringify({ text: ' Notes\r\n', base: '' }))
      renderAppAt(`/files/${file.id}`, repository)
      await screen.findByText('Unsaved draft restored.')
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('does not warn about a rename, which changes the file but not its notes', async () => {
      const { repository, file } = await openFilePage()
      await startEditing()
      typeNotes('Notes')
      await repository.renameFile(file.id, { name: 'Unit 1a' })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Notes' })).toBeNull())
      expect(await repository.getFile(file.id)).toMatchObject({ name: 'Unit 1a', notes: 'Notes' })
    })

    it('still lets notes be edited and saved when the latest cannot be read', async () => {
      const { repository, file } = await openFilePage()
      vi.spyOn(repository, 'getFile').mockRejectedValueOnce(new ConnectionError())
      await startEditing()
      typeNotes('Notes')
      vi.spyOn(repository, 'getFile').mockRejectedValueOnce(new ConnectionError())
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      await waitFor(async () => expect((await repository.getFile(file.id))?.notes).toBe('Notes'))
    })
  })

  it('still edits notes when storage cannot be used', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    const { repository, file } = await openFilePage()
    await startEditing()
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
