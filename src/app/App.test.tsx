import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VocabDb } from '../data/db.ts'
import { MAX_BACKUP_FILE_BYTES } from '../domain/backup.ts'
import { ConnectionError, SessionExpiredError } from '../domain/errors.ts'
import { DexieRepository } from '../data/dexieRepository.ts'
import { App } from './App.tsx'
import { unusedLookup } from './testLookups.ts'

const MISSING_ID = '00000000-0000-4000-8000-ffffffffffff'

/** The real repository on an in-memory IndexedDB, so these tests cover UI and storage together. */
function openRepository(indexedDB: IDBFactory) {
  return new DexieRepository(new VocabDb({ indexedDB, IDBKeyRange }))
}

function renderApp(path = '/', indexedDB = new IDBFactory()) {
  window.location.hash = `#${path}`
  const repository = openRepository(indexedDB)
  const view = render(<App repository={repository} lookup={unusedLookup} />)
  return { ...view, repository, indexedDB }
}

function typeInto(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

/** "New folder" / "New file" / "Add term": the form is behind a button (design.md, steps 3–4). */
function openCreateForm(label: string) {
  fireEvent.click(screen.getByRole('button', { name: label }))
}

function chooseFile(file: File) {
  fireEvent.change(screen.getByLabelText('Backup file'), { target: { files: [file] } })
}

/** Through the header, as a user would. */
function goHome() {
  fireEvent.click(screen.getByRole('link', { name: 'Vocab' }))
}

/** Opens the ⋯ menu of the row named `name` and picks `action` in it. */
async function chooseFromMenu(name: string, action: string) {
  fireEvent.click(await screen.findByRole('button', { name: `More actions for "${name}"` }))
  fireEvent.click(screen.getByRole('menuitem', { name: action }))
}

/** Opens the in-place edit form of a term and returns queries scoped to it. */
async function startEditing(word: string) {
  await chooseFromMenu(word, `Edit "${word}"`)
  const row = screen.getByRole('button', { name: 'Save' }).closest('li')
  if (!row) throw new Error(`edit form for "${word}" not found`)
  return within(row)
}

/** The "Already in …" line under Term; the Pronunciation lookup has its own status line. */
function duplicateWarning() {
  const warning = screen.getAllByRole('status').find((element) => element.id.endsWith('-warning'))
  if (!warning) throw new Error('duplicate warning not found')
  return warning
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

describe('empty and error states (docs/design.md, step 6)', () => {
  it('an empty Home offers to create the first folder, keeping the header button', async () => {
    renderApp()
    expect(await screen.findByRole('heading', { name: 'No folders yet' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Restore a backup' })).toHaveAttribute(
      'href',
      '#/settings',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create your first folder' }))
    expect(screen.getByLabelText('New folder')).toHaveFocus()
    // The form takes the empty state's place.
    expect(screen.queryByRole('heading', { name: 'No folders yet' })).toBeNull()
    typeInto('New folder', 'IELTS')
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByRole('link', { name: 'IELTS' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'No folders yet' })).toBeNull()
    expect(screen.getByRole('button', { name: 'New folder' })).toHaveFocus()
  })

  it('an empty folder offers to create the first file', async () => {
    const indexedDB = new IDBFactory()
    const folder = await openRepository(indexedDB).createFolder({ name: 'IELTS' })
    renderApp(`/folders/${folder.id}`, indexedDB)
    expect(await screen.findByRole('heading', { name: 'No files yet' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Create your first file' }))
    expect(screen.getByLabelText('New file')).toHaveFocus()
  })

  it('a page that could not load says so, and Try again loads it, showing that it is loading', async () => {
    const indexedDB = new IDBFactory()
    const folder = await openRepository(indexedDB).createFolder({ name: 'IELTS' })
    const repository = openRepository(indexedDB)
    const real = repository.getFolderContents.bind(repository)
    let release: () => void = () => {}
    vi.spyOn(repository, 'getFolderContents')
      .mockRejectedValueOnce(new ConnectionError())
      .mockImplementationOnce(async (id) => {
        await new Promise<void>((resolve) => (release = resolve))
        return real(id)
      })
    window.location.hash = `#/folders/${folder.id}`
    render(<App repository={repository} lookup={unusedLookup} />)

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByRole('heading', { name: "Couldn't load this page" })).toBeVisible()
    // Nothing was written: the generic "may or may not have been saved" would mislead.
    expect(alert).toHaveTextContent(
      'Cannot reach the server. Check your connection, then try again.',
    )
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()

    release()
    expect(await screen.findByRole('heading', { name: 'IELTS' })).toBeInTheDocument()
  })
})

describe('folder → file → term', () => {
  it('creates everything through the UI and keeps it after a reload', async () => {
    const { unmount, indexedDB } = renderApp()
    await screen.findByText(/No folders yet/)

    openCreateForm('New folder')
    typeInto('New folder', 'IELTS')
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    fireEvent.click(await screen.findByRole('link', { name: 'IELTS' }))

    await screen.findByRole('heading', { name: 'IELTS' })
    openCreateForm('New file')
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

    openCreateForm('New folder')
    typeInto('New folder', ' ielts ')
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A folder named "IELTS" already exists.',
    )
    expect(screen.getByLabelText('New folder')).toHaveValue(' ielts ')
  })

  it('opens the create form from its button and closes it after Create or Escape', async () => {
    renderApp()
    await screen.findByText(/No folders yet/)
    expect(screen.queryByLabelText('New folder')).not.toBeInTheDocument()

    openCreateForm('New folder')
    expect(screen.getByLabelText('New folder')).toHaveFocus()
    fireEvent.keyDown(screen.getByLabelText('New folder'), { key: 'Escape' })
    expect(screen.queryByLabelText('New folder')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New folder' })).toHaveFocus()

    openCreateForm('New folder')
    typeInto('New folder', 'IELTS')
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await screen.findByRole('link', { name: 'IELTS' })
    expect(screen.queryByLabelText('New folder')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New folder' })).toHaveFocus()
  })

  it('renames in place, and Escape cancels', async () => {
    const indexedDB = new IDBFactory()
    await openRepository(indexedDB).createFolder({ name: 'IELTS' })
    const { repository } = renderApp('/', indexedDB)

    await chooseFromMenu('IELTS', 'Rename folder "IELTS"')
    fireEvent.keyDown(screen.getByLabelText('Rename folder "IELTS"'), { key: 'Escape' })
    await chooseFromMenu('IELTS', 'Rename folder "IELTS"')
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

    await chooseFromMenu('IELTS', 'Delete folder "IELTS"')
    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith('Delete folder "IELTS" and its 2 files (1 term)?'),
    )
    expect(await repository.listFolders()).toHaveLength(1)

    await chooseFromMenu('IELTS', 'Delete folder "IELTS"')
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

  it('opens the add form on an empty file without focusing it, and keeps it open', async () => {
    await renderFile()
    expect(screen.getByLabelText('Term')).not.toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Add term' })).not.toBeInTheDocument()

    await addTerm('run', 'chạy')
    expect(screen.getByLabelText('Term')).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('Term')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add term' })).toHaveFocus()
  })

  it('keeps the add form behind "Add term" on a file with terms', async () => {
    const { unit1 } = await renderFile()
    window.location.hash = `#/files/${unit1.id}`
    await screen.findByRole('heading', { name: 'Unit 1' })
    expect(screen.queryByLabelText('Term')).not.toBeInTheDocument()

    openCreateForm('Add term')
    expect(screen.getByLabelText('Term')).toHaveFocus()
    fireEvent.keyDown(screen.getByLabelText('Term'), { key: 'Escape' })
    expect(screen.queryByLabelText('Term')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add term' })).toHaveFocus()
  })

  it('shows field errors from validation', async () => {
    await renderFile()
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('Term is required')).toBeInTheDocument()
    expect(screen.getByText('Meaning is required')).toBeInTheDocument()
    expect(screen.getByLabelText('Term')).toHaveAttribute('aria-invalid', 'true')
  })

  it('underlines typos in the English fields only (#60)', async () => {
    await renderFile()
    for (const label of ['Term', 'Example (optional)']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('spellcheck', 'true')
      expect(screen.getByLabelText(label)).toHaveAttribute('lang', 'en')
    }
    expect(screen.getByLabelText('Meaning')).toHaveAttribute('spellcheck', 'false')
  })

  it('warns while typing a word that exists elsewhere, but still adds it', async () => {
    await renderFile()
    typeInto('Term', ' RUN')
    await waitFor(() => expect(duplicateWarning()).toHaveTextContent('Already in IELTS / Unit 1'))

    await addTerm(' RUN', 'điều hành')
    // Now it also exists in this file; the cleared field shows no warning.
    expect(duplicateWarning()).toHaveTextContent(/^$/)
    typeInto('Term', 'run')
    await waitFor(() =>
      expect(duplicateWarning()).toHaveTextContent('Already in IELTS / Unit 1, IELTS / Unit 2'),
    )
  })

  it('does not warn about the term being edited', async () => {
    const { repository, unit2 } = await renderFile()
    await addTerm('walk', 'đi bộ')

    const [walk] = await repository.listTerms(unit2.id)
    const lookup = vi.spyOn(repository, 'findTermsByWord')
    const editRow = await startEditing('walk')
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
      const editRow = await startEditing('walk')
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

    const editRow = await startEditing('give up')
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

    await chooseFromMenu('walk', 'Delete "walk"')

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

    await chooseFromMenu('Unit 1', 'Rename file "Unit 1"')
    typeInto('Rename file "Unit 1"', 'Unit 01')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await chooseFromMenu('Unit 01', 'Delete file "Unit 01"')

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

    openCreateForm('New folder')
    typeInto('New folder', 'TOEIC')
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    )
    expect(screen.queryByText(/disk on fire/)).not.toBeInTheDocument()
  })
})

describe('cloud failures while writing', () => {
  it.each([
    ['the session expired', () => new SessionExpiredError()],
    ['the server cannot be reached', () => new ConnectionError()],
  ])('keeps the page and the typed term when %s', async (_, makeError) => {
    const indexedDB = new IDBFactory()
    const seed = openRepository(indexedDB)
    const folder = await seed.createFolder({ name: 'IELTS' })
    const file = await seed.createFile(folder.id, { name: 'Unit 1' })
    await seed.createTerm(file.id, { word: 'run', meaning: 'chạy' })
    const { repository } = renderApp(`/files/${file.id}`, indexedDB)
    await screen.findByText('run', { selector: '.term__word' })

    // The write fails, and so does the reload that follows it.
    vi.spyOn(repository, 'createTerm').mockRejectedValueOnce(makeError())
    vi.spyOn(repository, 'getFile').mockRejectedValueOnce(makeError())
    openCreateForm('Add term')
    typeInto('Term', 'walk')
    typeInto('Meaning', 'đi bộ')
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText(makeError().message, { selector: 'form *' })).toBeInTheDocument()
    expect(await screen.findByText(/could not be refreshed/)).toBeInTheDocument()
    expect(screen.getByLabelText('Term')).toHaveValue('walk')
    expect(screen.getByLabelText('Meaning')).toHaveValue('đi bộ')
    expect(screen.getByText('run', { selector: '.term__word' })).toBeInTheDocument()

    // Back online / signed in again: the same click saves it, and the page refreshes.
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await screen.findByText('walk', { selector: '.term__word' })
    expect(screen.queryByText(/could not be refreshed/)).not.toBeInTheDocument()
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

    renderApp('/settings', indexedDB)
    fireEvent.click(await screen.findByRole('button', { name: 'Export JSON' }))

    await waitFor(() => expect(click).toHaveBeenCalledOnce())
    expect(click.mock.contexts[0]).toMatchObject({
      download: expect.stringMatching(/^vocab-backup-\d{4}-\d{2}-\d{2}\.json$/),
    })
    const backup = JSON.parse(await blobs[0]!.text())
    expect(backup).toMatchObject({
      schemaVersion: 3,
      folders: [{ name: 'IELTS' }],
      files: [{ name: 'Unit 1' }],
      terms: [{ word: 'run', meaning: 'chạy' }],
    })
  })
})

describe('streak on Home', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  /** Only `Date`: IndexedDB and React still need the real timers. */
  function setToday(day: string) {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(`${day}T12:00:00+07:00`) })
  }

  /** A real answer through the repository, so the study day is what Learn would really write. */
  async function answerOn(repository: DexieRepository, day: string, count: number) {
    const folder = await repository.createFolder({ name: `Folder ${day}` })
    const file = await repository.createFile(folder.id, { name: 'Unit' })
    for (let i = 0; i < count; i += 1) {
      const term = await repository.createTerm(file.id, { word: `w${i}`, meaning: 'm' })
      await repository.recordAnswer({
        termId: term.id,
        correct: true,
        promote: false,
        answeredAt: `${day}T05:00:00.${String(i).padStart(3, '0')}Z`,
        day,
      })
    }
  }

  async function backupWithStudyDay(day: string) {
    const source = openRepository(new IDBFactory())
    await answerOn(source, day, 10)
    const backup = await source.exportBackup()
    return new File([JSON.stringify(backup)], 'vocab-backup.json')
  }

  it('shows the answers stored for today', async () => {
    setToday('2026-11-05')
    const indexedDB = new IDBFactory()
    const seeded = openRepository(indexedDB)
    await answerOn(seeded, '2026-11-04', 10)
    await answerOn(seeded, '2026-11-05', 4)

    renderApp('/', indexedDB)

    expect(await screen.findByText('🔥 1-day streak · Best 1')).toBeInTheDocument()
    expect(screen.getByText('Today: 4/10 answers')).toBeInTheDocument()
  })

  it('keeps the folders usable when the study days cannot be read', async () => {
    const indexedDB = new IDBFactory()
    const seeded = openRepository(indexedDB)
    await seeded.createFolder({ name: 'IELTS' })
    const repository = openRepository(indexedDB)
    vi.spyOn(repository, 'listStudyDays').mockRejectedValue(new ConnectionError())
    window.location.hash = '#/'
    render(<App repository={repository} lookup={unusedLookup} />)

    expect(await screen.findByRole('link', { name: 'IELTS' })).toBeInTheDocument()
    expect(await screen.findByText('Streak could not be loaded.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps the streak usable when the folders cannot be read', async () => {
    const repository = openRepository(new IDBFactory())
    vi.spyOn(repository, 'listFolders').mockRejectedValue(new ConnectionError())
    window.location.hash = '#/'
    render(<App repository={repository} lookup={unusedLookup} />)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(await screen.findByText('Start a streak today')).toBeInTheDocument()
  })

  it('shows the restored study days back on Home', async () => {
    setToday('2026-11-05')
    const file = await backupWithStudyDay('2026-11-05')
    const { repository } = renderApp('/')
    await screen.findByText('Start a streak today')
    fireEvent.click(screen.getByRole('link', { name: 'Settings' }))

    chooseFile(file)
    fireEvent.click(await screen.findByRole('button', { name: 'Restore' }))
    await screen.findByText(/^Restored 1 folder/)
    const list = vi.spyOn(repository, 'listStudyDays')
    goHome()

    expect(await screen.findByText('🔥 1-day streak · Best 1')).toBeInTheDocument()
    expect(screen.getByText('Today: 10 answers ✓')).toBeInTheDocument()
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('shows the study days of a restore that went through but lost its answer', async () => {
    setToday('2026-11-05')
    const file = await backupWithStudyDay('2026-11-05')
    const { repository } = renderApp('/settings')
    await screen.findByRole('heading', { name: 'Settings' })
    const replaceAll = repository.replaceAll.bind(repository)
    vi.spyOn(repository, 'replaceAll').mockImplementation(async (backup) => {
      await replaceAll(backup)
      throw new ConnectionError()
    })

    chooseFile(file)
    fireEvent.click(await screen.findByRole('button', { name: 'Restore' }))
    await screen.findByText(/may or may not have finished/)
    goHome()

    expect(await screen.findByText('🔥 1-day streak · Best 1')).toBeInTheDocument()
  })

  it('does not load the streak again for a new folder', async () => {
    const { repository } = renderApp()
    await screen.findByText('Start a streak today')
    const list = vi.spyOn(repository, 'listStudyDays')

    openCreateForm('New folder')
    typeInto('New folder', 'IELTS')
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await screen.findByRole('link', { name: 'IELTS' })
    expect(list).not.toHaveBeenCalled()
  })

  describe('coming back to the page', () => {
    async function renderHomeOnNov5() {
      setToday('2026-11-05')
      const view = renderApp()
      await screen.findByText('Today: 0/10 answers')
      // The listeners are added in an effect, which may run after the text appears.
      await act(async () => {})
      return view
    }

    function setVisibility(state: DocumentVisibilityState) {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state)
    }

    it('shows answers given elsewhere when the page becomes visible', async () => {
      const { repository } = await renderHomeOnNov5()
      await answerOn(repository, '2026-11-05', 2)

      setVisibility('visible')
      fireEvent(document, new Event('visibilitychange'))

      expect(await screen.findByText('Today: 2/10 answers')).toBeInTheDocument()
    })

    it('does nothing when the page becomes hidden', async () => {
      const { repository } = await renderHomeOnNov5()
      const list = vi.spyOn(repository, 'listStudyDays')

      setVisibility('hidden')
      fireEvent(document, new Event('visibilitychange'))
      await act(async () => {})

      expect(list).not.toHaveBeenCalled()
    })

    it('shows answers given elsewhere when the window gets focus', async () => {
      const { repository } = await renderHomeOnNov5()
      await answerOn(repository, '2026-11-05', 3)

      fireEvent(window, new Event('focus'))

      expect(await screen.findByText('Today: 3/10 answers')).toBeInTheDocument()
    })

    it('starts counting the new day when coming back after midnight', async () => {
      const { repository } = await renderHomeOnNov5()
      await answerOn(repository, '2026-11-05', 10)
      fireEvent(window, new Event('focus'))
      await screen.findByText('Today: 10 answers ✓')

      setToday('2026-11-06')
      fireEvent(window, new Event('focus'))

      expect(await screen.findByText('Today: 0/10 answers')).toBeInTheDocument()
      expect(screen.getByText('🔥 1-day streak · Best 1')).toBeInTheDocument()
    })

    it('keeps the numbers and a quiet note when reloading fails', async () => {
      const { repository } = await renderHomeOnNov5()
      vi.spyOn(repository, 'listStudyDays').mockRejectedValue(new ConnectionError())

      fireEvent(window, new Event('focus'))

      expect(await screen.findByText('Streak may be out of date.')).toBeInTheDocument()
      expect(screen.getByText('Today: 0/10 answers')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})

describe('restore from backup', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  /** What Export JSON downloads, made through another browser's repository. */
  async function exportedBackup() {
    const source = openRepository(new IDBFactory())
    const folder = await source.createFolder({ name: 'IELTS' })
    const file = await source.createFile(folder.id, { name: 'Unit 1' })
    await source.createTerm(file.id, { word: 'run', meaning: 'chạy' })
    return source.exportBackup()
  }

  const asFile = (backup: unknown, name = 'vocab-backup.json') =>
    new File([JSON.stringify(backup, null, 2)], name)

  const backupSection = () => within(screen.getByRole('region', { name: 'Backup' }))

  /** As a keyboard user would: fireEvent.click alone does not move focus. */
  async function pressButton(name: string) {
    const button = await screen.findByRole('button', { name })
    button.focus()
    fireEvent.click(button)
  }

  /** Focus left the removed button for an element holding `text`, not for the whole page. */
  function expectFocusOn(text: string) {
    expect(document.activeElement).not.toBe(document.body)
    expect(document.activeElement).toHaveTextContent(text)
  }

  /** Current data the file does not have: a folder, and a study day (which a restore removes). */
  async function renderWithCurrentData() {
    const indexedDB = new IDBFactory()
    const seed = openRepository(indexedDB)
    const folder = await seed.createFolder({ name: 'Old' })
    const file = await seed.createFile(folder.id, { name: 'Old unit' })
    const term = await seed.createTerm(file.id, { word: 'walk', meaning: 'đi bộ' })
    // Ten answers: the daily goal, so the day counts in the streak.
    for (let i = 0; i < 10; i += 1) {
      await seed.recordAnswer({
        termId: term.id,
        correct: true,
        promote: false,
        answeredAt: `2026-11-01T05:00:00.${String(i).padStart(3, '0')}Z`,
        day: '2026-11-01',
      })
    }
    const view = renderApp('/settings', indexedDB)
    await screen.findByRole('heading', { name: 'Settings' })
    return view
  }

  it('restores into an empty account without warnings', async () => {
    const file = asFile(await exportedBackup())
    renderApp('/settings')
    await screen.findByRole('heading', { name: 'Settings' })

    chooseFile(file)

    expect(await screen.findByText('This file has 1 folder, 1 file and 1 term.')).toBeVisible()
    expect(screen.queryByText('Close the app on other devices first.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Replace all' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))

    expect(await backupSection().findByText('Restored 1 folder, 1 file and 1 term.')).toBeVisible()
    goHome()
    fireEvent.click(await screen.findByRole('link', { name: 'IELTS' }))
    expect(await screen.findByText('1 term · 0% mastered')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /Unit 1/ }))
    expect(await screen.findByText('chạy')).toBeInTheDocument()
  })

  it('compares current data with the file and warns about what will be lost', async () => {
    const file = asFile(await exportedBackup())
    await renderWithCurrentData()

    chooseFile(file)

    const table = await screen.findByRole('table', { name: /Replace your current data/ })
    const cells = (row: string) =>
      within(within(table).getByRole('row', { name: new RegExp(`^${row}`) }))
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
    expect(cells('Folders')).toStrictEqual(['1', '1'])
    expect(cells('Terms')).toStrictEqual(['1', '1'])
    expect(cells('Last study day')).toStrictEqual(['1 Nov 2026', '—'])
    // Current data was made after the file, so its edits are newer.
    expect(
      screen.getByText(
        'Your current data is newer than this backup. Changes made since then will be lost.',
      ),
    ).toBeVisible()
    expect(
      screen.getByText(
        '1 study day not in the backup will be removed, so your streak may go down.',
      ),
    ).toBeVisible()
    expect(screen.getByText('Close the app on other devices first.')).toBeVisible()
    expect(screen.queryByText(/has a problem/)).not.toBeInTheDocument()
  })

  it('replaces folders, terms and the streak with the file', async () => {
    const file = asFile(await exportedBackup())
    // Only `Date`: IndexedDB and React still need the real timers.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-01T12:00:00+07:00') })
    const { repository } = await renderWithCurrentData()
    expect(await repository.listStudyDays()).toHaveLength(1)

    chooseFile(file)
    await pressButton('Replace all')

    await screen.findByText(/^Restored 1 folder/)
    // Focus follows the outcome, not the button that just disappeared.
    expectFocusOn('Restored 1 folder')
    expect(
      screen.queryByRole('table', { name: /Replace your current data/ }),
    ).not.toBeInTheDocument()
    expect(await repository.listStudyDays()).toStrictEqual([])
    goHome()
    expect(await screen.findByRole('link', { name: 'IELTS' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Old' })).not.toBeInTheDocument()
    expect(await screen.findByText('Start a streak today')).toBeInTheDocument()
  })

  it('writes nothing on Cancel', async () => {
    const file = asFile(await exportedBackup())
    const { repository } = await renderWithCurrentData()
    const replaceAll = vi.spyOn(repository, 'replaceAll')

    chooseFile(file)
    await pressButton('Cancel')

    expect(
      screen.queryByRole('table', { name: /Replace your current data/ }),
    ).not.toBeInTheDocument()
    expect(document.activeElement).toBe(screen.getByLabelText('Backup file'))
    expect(replaceAll).not.toHaveBeenCalled()
    expect(await repository.listFolders()).toMatchObject([{ name: 'Old' }])
  })

  it('downloads the current data it compared, without writing', async () => {
    const file = asFile(await exportedBackup())
    const { repository } = await renderWithCurrentData()
    const replaceAll = vi.spyOn(repository, 'replaceAll')
    const blobs: Blob[] = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob as Blob)
      return 'blob:backup'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    chooseFile(file)
    fireEvent.click(await screen.findByRole('button', { name: 'Download current data first' }))

    expect(click).toHaveBeenCalledOnce()
    const copy = JSON.parse(await blobs[0]!.text())
    expect(copy).toMatchObject({ folders: [{ name: 'Old' }], terms: [{ word: 'walk' }] })
    const { exportedAt: _, ...stored } = await repository.exportBackup()
    expect(copy).toStrictEqual({
      ...JSON.parse(JSON.stringify(stored)),
      exportedAt: copy.exportedAt,
    })
    expect(replaceAll).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Replace all' })).toBeEnabled()
  })

  it('warns when a copy of current data could not be restored as is', async () => {
    const file = asFile(await exportedBackup())
    const { repository } = await renderWithCurrentData()
    const exportBackup = repository.exportBackup.bind(repository)
    // A stored row the schema would reject: exportBackup returns it as is (#41).
    vi.spyOn(repository, 'exportBackup').mockImplementation(async () => {
      const current = await exportBackup()
      return { ...current, folders: current.folders.map((f) => ({ ...f, name: ' Old' })) }
    })

    chooseFile(file)

    expect(
      await screen.findByText(/^Your current data has a problem \(folders\.0\.name/),
    ).toHaveTextContent(/a copy taken now cannot be restored as is\.$/)
    expect(screen.getByRole('button', { name: 'Replace all' })).toBeEnabled()
  })

  it('says a restore may have finished when its answer was lost, and shows the result', async () => {
    const file = asFile(await exportedBackup())
    const { repository } = await renderWithCurrentData()
    const replaceAll = repository.replaceAll.bind(repository)
    vi.spyOn(repository, 'replaceAll').mockImplementation(async (backup) => {
      await replaceAll(backup)
      throw new ConnectionError()
    })

    chooseFile(file)
    await pressButton('Replace all')

    expect(await backupSection().findByRole('alert')).toHaveTextContent(
      'The restore may or may not have finished. Check your folders on Home; restoring the same ' +
        'file again is safe.',
    )
    // The comparison was of data that may have changed since.
    expect(
      screen.queryByRole('table', { name: /Replace your current data/ }),
    ).not.toBeInTheDocument()
    goHome()
    expect(await screen.findByRole('link', { name: 'IELTS' })).toBeInTheDocument()
    expect(await screen.findByText('Start a streak today')).toBeInTheDocument()
  })

  it.each([
    ['a rolled-back error', () => new Error('statement timeout'), 'Something went wrong.'],
    ['an expired session', () => new SessionExpiredError(), 'Your session has expired.'],
  ])('keeps the comparison to try again after %s', async (_, failure, message) => {
    const file = asFile(await exportedBackup())
    const { repository } = await renderWithCurrentData()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const replaceAll = vi.spyOn(repository, 'replaceAll').mockRejectedValueOnce(failure())

    chooseFile(file)
    await pressButton('Replace all')

    expect(await backupSection().findByRole('alert')).toHaveTextContent(message)
    expectFocusOn(message)
    expect(await repository.listFolders()).toMatchObject([{ name: 'Old' }])
    await pressButton('Replace all')
    expect(await screen.findByText(/^Restored 1 folder/)).toBeInTheDocument()
    expect(replaceAll).toHaveBeenCalledTimes(2)
    expect(backupSection().queryByRole('alert')).not.toBeInTheDocument()
  })

  it('lists the first problems of an invalid file with where they are', async () => {
    const backup = await exportedBackup()
    renderApp('/settings')
    await screen.findByRole('heading', { name: 'Settings' })
    const broken = { ...backup, terms: backup.terms.map((t) => ({ ...t, word: '' })) }

    chooseFile(asFile(broken, 'broken.json'))

    expect(await screen.findByRole('alert')).toHaveTextContent(/^terms\.0\.word: /)
    expect(
      screen.queryByRole('button', { name: /^Restore$|^Replace all$/ }),
    ).not.toBeInTheDocument()
  })

  it('refuses a file too big to be a backup without reading it', async () => {
    const file = asFile(await exportedBackup())
    renderApp('/settings')
    await screen.findByRole('heading', { name: 'Settings' })
    Object.defineProperty(file, 'size', { value: MAX_BACKUP_FILE_BYTES + 1 })
    const text = vi.spyOn(file, 'text')

    chooseFile(file)

    expect(await screen.findByRole('alert')).toHaveTextContent('larger than 5 MB')
    expect(text).not.toHaveBeenCalled()
  })
})
