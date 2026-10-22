import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VocabDb } from '../data/db.ts'
import { DexieRepository } from '../data/dexieRepository.ts'
import { App } from './App.tsx'

const MISSING_ID = '00000000-0000-4000-8000-ffffffffffff'

/** The real repository on an in-memory IndexedDB, so these tests cover UI and storage together. */
function openRepository(indexedDB: IDBFactory) {
  return new DexieRepository(new VocabDb({ indexedDB, IDBKeyRange }))
}

function renderApp(path = '/', indexedDB = new IDBFactory()) {
  window.location.hash = `#${path}`
  const repository = openRepository(indexedDB)
  const view = render(<App repository={repository} />)
  return { ...view, repository, indexedDB }
}

function typeInto(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

/** Opens the in-place edit form of a term and returns queries scoped to it. */
function startEditing(word: string) {
  fireEvent.click(screen.getByRole('button', { name: `Edit "${word}"` }))
  const row = screen.getByRole('button', { name: 'Save' }).closest('li')
  if (!row) throw new Error(`edit form for "${word}" not found`)
  return within(row)
}

async function addTerm(word: string, meaning: string, example = '') {
  typeInto('Term', word)
  typeInto('Meaning', meaning)
  typeInto('Example (optional)', example)
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  await screen.findByText(word.trim(), { selector: '.term__word' })
}

afterEach(() => {
  vi.restoreAllMocks()
  window.location.hash = ''
})

describe('folder → file → term', () => {
  it('creates everything through the UI and keeps it after a reload', async () => {
    const { unmount, indexedDB } = renderApp()
    await screen.findByText(/No folders yet/)

    typeInto('New folder', 'IELTS')
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    fireEvent.click(await screen.findByRole('link', { name: 'IELTS' }))

    await screen.findByRole('heading', { name: 'IELTS' })
    typeInto('New file', 'Unit 1')
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(await screen.findByText('0 terms · 0% mastered')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /Unit 1/ }))

    await screen.findByRole('heading', { name: 'Unit 1' })
    await addTerm('run', 'chạy', 'I run every day.')
    await addTerm('walk', 'đi bộ')

    // Form is cleared and focused for the next term.
    expect(screen.getByLabelText('Term')).toHaveValue('')
    expect(screen.getByLabelText('Term')).toHaveFocus()
    // Newest first.
    const words = within(screen.getByRole('list', { name: 'Terms' }))
      .getAllByText(/^(run|walk)$/)
      .map((el) => el.textContent)
    expect(words).toEqual(['walk', 'run'])

    // "Reload": a new connection to the same browser database.
    unmount()
    renderApp('/', indexedDB)
    fireEvent.click(await screen.findByRole('link', { name: 'IELTS' }))
    expect(await screen.findByText('2 terms · 0% mastered')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /Unit 1/ }))
    expect(await screen.findByText('I run every day.')).toBeInTheDocument()
  })
})

describe('folders', () => {
  it('shows a duplicate name error next to the field', async () => {
    const { repository } = renderApp()
    await repository.createFolder({ name: 'IELTS' })
    await screen.findByText(/No folders yet/)

    typeInto('New folder', ' ielts ')
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A folder named "IELTS" already exists.',
    )
    expect(screen.getByLabelText('New folder')).toHaveValue(' ielts ')
  })

  it('renames in place, and Escape cancels', async () => {
    const indexedDB = new IDBFactory()
    await openRepository(indexedDB).createFolder({ name: 'IELTS' })
    const { repository } = renderApp('/', indexedDB)

    fireEvent.click(await screen.findByRole('button', { name: 'Rename folder "IELTS"' }))
    fireEvent.keyDown(screen.getByLabelText('Rename folder "IELTS"'), { key: 'Escape' })
    fireEvent.click(await screen.findByRole('button', { name: 'Rename folder "IELTS"' }))
    typeInto('Rename folder "IELTS"', 'IELTS Writing')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('link', { name: 'IELTS Writing' })).toBeInTheDocument()
    expect(await repository.listFolders()).toMatchObject([{ name: 'IELTS Writing' }])
  })

  it('asks before deleting, saying how much is inside', async () => {
    const indexedDB = new IDBFactory()
    const seed = openRepository(indexedDB)
    const folder = await seed.createFolder({ name: 'IELTS' })
    const unit1 = await seed.createFile(folder.id, { name: 'Unit 1' })
    await seed.createFile(folder.id, { name: 'Unit 2' })
    await seed.createTerm(unit1.id, { word: 'run', meaning: 'chạy' })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    const { repository } = renderApp('/', indexedDB)

    fireEvent.click(await screen.findByRole('button', { name: 'Delete folder "IELTS"' }))
    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith('Delete folder "IELTS" and its 2 files (1 term)?'),
    )
    expect(await repository.listFolders()).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Delete folder "IELTS"' }))
    expect(await screen.findByText(/No folders yet/)).toBeInTheDocument()
    expect(await repository.listFolders()).toEqual([])
  })
})

describe('terms', () => {
  async function renderFile() {
    const indexedDB = new IDBFactory()
    const seed = openRepository(indexedDB)
    const ielts = await seed.createFolder({ name: 'IELTS' })
    const unit1 = await seed.createFile(ielts.id, { name: 'Unit 1' })
    const unit2 = await seed.createFile(ielts.id, { name: 'Unit 2' })
    await seed.createTerm(unit1.id, { word: 'run', meaning: 'chạy' })
    const view = renderApp(`/files/${unit2.id}`, indexedDB)
    await screen.findByRole('heading', { name: 'Unit 2' })
    return { ...view, unit1, unit2 }
  }

  it('shows field errors from validation', async () => {
    await renderFile()
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('Term is required')).toBeInTheDocument()
    expect(screen.getByText('Meaning is required')).toBeInTheDocument()
    expect(screen.getByLabelText('Term')).toHaveAttribute('aria-invalid', 'true')
  })

  it('warns while typing a word that exists elsewhere, but still adds it', async () => {
    await renderFile()
    typeInto('Term', ' RUN')
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Already in IELTS / Unit 1'),
    )

    await addTerm(' RUN', 'điều hành')
    // Now it also exists in this file; the cleared field shows no warning.
    expect(screen.getByRole('status')).toHaveTextContent(/^$/)
    typeInto('Term', 'run')
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Already in IELTS / Unit 1, IELTS / Unit 2',
      ),
    )
  })

  it('does not warn about the term being edited', async () => {
    const { repository, unit2 } = await renderFile()
    await addTerm('walk', 'đi bộ')

    const [walk] = await repository.listTerms(unit2.id)
    const lookup = vi.spyOn(repository, 'findTermsByWord')
    const editRow = startEditing('walk')
    fireEvent.change(editRow.getByLabelText('Meaning'), { target: { value: 'đi dạo' } })
    // Wait for the edit form's own lookup to finish rather than a fixed delay.
    await waitFor(() => expect(lookup).toHaveBeenCalledWith('walk', walk?.id))
    expect(await lookup.mock.results.at(-1)?.value).toEqual([])
    for (const region of screen.getAllByRole('status')) expect(region).toHaveTextContent(/^$/)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('đi dạo')).toBeInTheDocument()
    expect(await repository.listTerms(unit2.id)).toMatchObject([
      { word: 'walk', meaning: 'đi dạo' },
    ])
  })

  it('cancels an edit with Escape or Cancel without saving', async () => {
    const { repository, unit2 } = await renderFile()
    await addTerm('walk', 'đi bộ')

    for (const cancel of ['escape', 'button'] as const) {
      const editRow = startEditing('walk')
      fireEvent.change(editRow.getByLabelText('Meaning'), {
        target: { value: 'changed' },
      })
      if (cancel === 'escape') {
        fireEvent.keyDown(editRow.getByLabelText('Meaning'), { key: 'Escape' })
      } else {
        fireEvent.click(editRow.getByRole('button', { name: 'Cancel' }))
      }
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    }
    expect(screen.getByText('đi bộ')).toBeInTheDocument()
    expect(await repository.listTerms(unit2.id)).toMatchObject([{ meaning: 'đi bộ' }])
  })

  it('saves an optional part of speech and shows its abbreviation', async () => {
    const { repository, unit2 } = await renderFile()
    typeInto('Part of speech', 'phrasal verb')
    await addTerm('give up', 'từ bỏ')
    expect(screen.getByText('phr. v.')).toHaveAttribute('title', 'phrasal verb')
    // Reset for the next term.
    expect(screen.getByLabelText('Part of speech')).toHaveValue('')

    const editRow = startEditing('give up')
    const select = editRow.getByLabelText('Part of speech')
    expect(select).toHaveValue('phrasal verb')
    fireEvent.change(select, { target: { value: '' } })
    fireEvent.click(editRow.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByText('phr. v.')).not.toBeInTheDocument())
    expect((await repository.listTerms(unit2.id))[0]).not.toHaveProperty('partOfSpeech')
  })

  it('reads a word aloud in British English', async () => {
    const speak = vi.fn()
    const cancel = vi.fn()
    const british = { lang: 'en_GB' } // Android's spelling
    vi.stubGlobal('speechSynthesis', {
      speak,
      cancel,
      getVoices: () => [{ lang: 'en-US' }, british],
    })
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        lang = ''
        voice: unknown = null
        readonly text: string
        constructor(text: string) {
          this.text = text
        }
      },
    )
    try {
      await renderFile()
      await addTerm('walk', 'đi bộ')
      fireEvent.click(screen.getByRole('button', { name: 'Listen to "walk"' }))
      expect(cancel).toHaveBeenCalled()
      expect(speak).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'walk', lang: 'en-GB', voice: british }),
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('hides the Listen button when the browser cannot speak', async () => {
    await renderFile()
    await addTerm('walk', 'đi bộ')
    expect(screen.queryByRole('button', { name: /Listen/ })).not.toBeInTheDocument()
  })

  it('asks before deleting a term', async () => {
    const { repository, unit2 } = await renderFile()
    await addTerm('walk', 'đi bộ')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Delete "walk"' }))

    expect(confirm).toHaveBeenCalledWith('Delete "walk"?')
    await waitFor(() => expect(screen.queryByText('walk')).not.toBeInTheDocument())
    expect(await repository.listTerms(unit2.id)).toEqual([])
  })
})

describe('files', () => {
  it('renames and deletes a file, confirming with its term count', async () => {
    const indexedDB = new IDBFactory()
    const seed = openRepository(indexedDB)
    const folder = await seed.createFolder({ name: 'IELTS' })
    const unit1 = await seed.createFile(folder.id, { name: 'Unit 1' })
    await seed.createTerm(unit1.id, { word: 'run', meaning: 'chạy' })
    await seed.createTerm(unit1.id, { word: 'walk', meaning: 'đi bộ' })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { repository } = renderApp(`/folders/${folder.id}`, indexedDB)

    fireEvent.click(await screen.findByRole('button', { name: 'Rename file "Unit 1"' }))
    typeInto('Rename file "Unit 1"', 'Unit 01')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete file "Unit 01"' }))

    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith('Delete file "Unit 01" and its 2 terms?'),
    )
    expect(await screen.findByText(/No files yet/)).toBeInTheDocument()
    expect(await repository.listFiles(folder.id)).toEqual([])
  })
})

describe('writes after another tab deleted the page', () => {
  it('shows "no longer exists" instead of a form that keeps failing', async () => {
    const indexedDB = new IDBFactory()
    const seed = openRepository(indexedDB)
    const folder = await seed.createFolder({ name: 'IELTS' })
    const file = await seed.createFile(folder.id, { name: 'Unit 1' })
    renderApp(`/files/${file.id}`, indexedDB)
    await screen.findByRole('heading', { name: 'Unit 1' })

    await seed.deleteFolder(folder.id) // the "other tab"
    typeInto('Term', 'run')
    typeInto('Meaning', 'chạy')
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(
      await screen.findByRole('heading', { name: 'This file no longer exists.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to your folders' })).toBeInTheDocument()
  })
})

describe('unexpected errors', () => {
  it('shows a generic message instead of internals', async () => {
    const indexedDB = new IDBFactory()
    await openRepository(indexedDB).createFolder({ name: 'IELTS' })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository } = renderApp('/', indexedDB)
    vi.spyOn(repository, 'createFolder').mockRejectedValue(new Error('disk on fire'))
    await screen.findByRole('link', { name: 'IELTS' })

    typeInto('New folder', 'TOEIC')
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    )
    expect(screen.queryByText(/disk on fire/)).not.toBeInTheDocument()
  })
})

describe('missing pages', () => {
  it('says when a folder or file no longer exists', async () => {
    renderApp(`/folders/${MISSING_ID}`)
    expect(
      await screen.findByRole('heading', { name: 'This folder no longer exists.' }),
    ).toBeInTheDocument()

    window.location.hash = `#/files/${MISSING_ID}`
    expect(
      await screen.findByRole('heading', { name: 'This file no longer exists.' }),
    ).toBeInTheDocument()

    window.location.hash = '#/nowhere'
    expect(await screen.findByRole('heading', { name: 'Page not found.' })).toBeInTheDocument()
  })
})

describe('backup', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('downloads every folder, file and term as a JSON file', async () => {
    const indexedDB = new IDBFactory()
    const seed = openRepository(indexedDB)
    const folder = await seed.createFolder({ name: 'IELTS' })
    const file = await seed.createFile(folder.id, { name: 'Unit 1' })
    await seed.createTerm(file.id, { word: 'run', meaning: 'chạy' })
    const blobs: Blob[] = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob as Blob)
      return 'blob:backup'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderApp('/', indexedDB)
    fireEvent.click(await screen.findByRole('button', { name: 'Export JSON' }))

    await waitFor(() => expect(click).toHaveBeenCalledOnce())
    expect(click.mock.contexts[0]).toMatchObject({
      download: expect.stringMatching(/^vocab-backup-\d{4}-\d{2}-\d{2}\.json$/),
    })
    const backup = JSON.parse(await blobs[0]!.text())
    expect(backup).toMatchObject({
      schemaVersion: 1,
      folders: [{ name: 'IELTS' }],
      files: [{ name: 'Unit 1' }],
      terms: [{ word: 'run', meaning: 'chạy' }],
    })
  })
})
