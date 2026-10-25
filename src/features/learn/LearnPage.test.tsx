import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../app/App.tsx'
import { VocabDb } from '../../data/db.ts'
import { DexieRepository } from '../../data/dexieRepository.ts'
import { ConnectionError } from '../../domain/errors.ts'

const MISSING_ID = '00000000-0000-4000-8000-ffffffffffff'
/** The 0.8 s pause after a right pick, plus room for a slow CI. */
const AFTER_PAUSE = { timeout: 3000 }

/** The real page on the real repository (in-memory IndexedDB): UI and storage tested together. */
async function setUp(terms: { word: string; meaning: string; example?: string }[]) {
  const repository = new DexieRepository(new VocabDb({ indexedDB: new IDBFactory(), IDBKeyRange }))
  const folder = await repository.createFolder({ name: 'IELTS' })
  const file = await repository.createFile(folder.id, { name: 'Unit 1' })
  for (const term of terms) await repository.createTerm(file.id, term)
  const wordOf = new Map(terms.map((term) => [term.meaning, term.word]))
  return { repository, file, wordOf }
}

function renderAt(repository: DexieRepository, path: string) {
  window.location.hash = `#${path}`
  render(<App repository={repository} />)
}

async function progressOf(repository: DexieRepository, fileId: string, word: string) {
  const data = await repository.getLearnData(fileId)
  const term = data?.terms.find((t) => t.word === word)
  return data?.progress.find((p) => p.termId === term?.id)
}

/**
 * The meaning asked, once a question can be answered: the feedback of the previous answer also
 * shows a meaning, so seeing a meaning is not enough.
 */
async function asked(): Promise<string> {
  await waitFor(() => {
    const choices = screen.queryByRole('list', { name: 'Choices' })
    const ready = choices
      ? within(choices).getAllByRole('button')[0]!.matches(':enabled')
      : screen.queryByRole('button', { name: 'Answer' }) !== null
    expect(ready).toBe(true)
  }, AFTER_PAUSE)
  // The keys 1-4 listener is added by an effect, after the buttons are on screen.
  await act(async () => {})
  return screen.getByRole('heading', { level: 2 }).textContent ?? ''
}

/** Answers the current question right, whichever kind it is. */
async function answerRight(wordOf: Map<string, string>) {
  const word = wordOf.get(await asked())!
  const choices = screen.queryByRole('list', { name: 'Choices' })
  if (choices) {
    fireEvent.click(within(choices).getByRole('button', { name: word }))
    await screen.findByText('Correct!')
  } else {
    fireEvent.change(screen.getByLabelText('Type the English word'), { target: { value: word } })
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
  }
  // Wait until this question is gone, so the next call reads the next one.
  await waitFor(() => expect(screen.queryByText(/Correct!|Saving…/)).toBeNull(), AFTER_PAUSE)
}

/** Answers right until a summary shows. */
async function answerAllRight(wordOf: Map<string, string>) {
  while (!screen.queryByRole('button', { name: /Next round|Study again/ })) {
    await answerRight(wordOf)
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  window.location.hash = ''
})

const TWO = [
  { word: 'run', meaning: 'chạy' },
  { word: 'walk', meaning: 'đi bộ' },
]

describe('Learn', () => {
  it('opens from the file page and learns every term, saving each answer', async () => {
    const { repository, file, wordOf } = await setUp(TWO)
    renderAt(repository, `/files/${file.id}`)
    fireEvent.click(await screen.findByRole('link', { name: 'Learn' }))

    expect(await screen.findByText('0 / 2 learned')).toBeInTheDocument()
    await answerAllRight(wordOf)
    // Both asked once (level 0 → 1): the round ends, the session does not.
    expect(await screen.findByRole('heading', { name: 'Round 1 done' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next round' }))
    await answerAllRight(wordOf)

    expect(await screen.findByRole('heading', { name: 'You learned all 2 terms!' })).toBeVisible()
    expect(screen.getByText('4 answers: 4 right, 0 wrong.')).toBeInTheDocument()
    expect(screen.getByText('2 / 2 learned')).toBeInTheDocument()
    // No mistake this session: one box up.
    expect(await progressOf(repository, file.id, 'run')).toMatchObject({
      box: 2,
      correctCount: 2,
      wrongCount: 0,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Study again' }))
    expect(await screen.findByText('0 / 2 learned')).toBeInTheDocument()
  })

  it('saves a wrong pick before Continue and shows the right word', async () => {
    const { repository, file, wordOf } = await setUp(TWO)
    renderAt(repository, `/files/${file.id}/learn`)
    const word = wordOf.get(await asked())!
    const wrong = within(screen.getByRole('list', { name: 'Choices' }))
      .getAllByRole('button')
      .find(
        (button) => button.textContent !== `${1}${word}` && !button.textContent?.endsWith(word),
      )!
    fireEvent.click(wrong)

    expect(await screen.findByText('Not quite.')).toBeInTheDocument()
    expect(screen.getByText(word, { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'I was right' })).toBeNull()
    expect(await progressOf(repository, file.id, word)).toMatchObject({ wrongCount: 1, box: 1 })
  })

  it('picks with keys', async () => {
    const { repository, file, wordOf } = await setUp(TWO)
    const record = vi.spyOn(repository, 'recordAnswer')
    renderAt(repository, `/files/${file.id}/learn`)
    const word = wordOf.get(await asked())!
    const buttons = within(screen.getByRole('list', { name: 'Choices' })).getAllByRole('button')
    // Two terms, two options: "3" is no option.
    fireEvent.keyDown(window, { key: '3' })
    expect(record).not.toHaveBeenCalled()

    fireEvent.keyDown(window, { key: '2' })
    await waitFor(() => expect(record).toHaveBeenCalledTimes(1))
    expect(record.mock.calls[0]![0].correct).toBe(buttons[1]!.textContent === `2${word}`)
  })

  it('locks the options after a pick, so a second click or key saves nothing more', async () => {
    const { repository, file } = await setUp(TWO)
    const record = vi.spyOn(repository, 'recordAnswer')
    renderAt(repository, `/files/${file.id}/learn`)
    await asked()
    const buttons = within(screen.getByRole('list', { name: 'Choices' })).getAllByRole('button')
    fireEvent.click(buttons[0]!)
    fireEvent.click(buttons[1]!)
    fireEvent.keyDown(window, { key: '2' })
    await waitFor(() => expect(buttons[0]).toBeDisabled())
    await screen.findByText(/Correct!|Not quite\./)
    expect(record).toHaveBeenCalledTimes(1)
  })

  it('a written answer graded wrong can be counted right with "I was right"', async () => {
    const { repository, file } = await setUp([
      { word: 'big', meaning: 'to', example: 'A big house.' },
    ])
    // No distractor at all: even level 0 is written.
    renderAt(repository, `/files/${file.id}/learn`)
    await asked()
    expect(screen.getByText('A ____ house.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Type the English word'), { target: { value: 'large' } })
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }))

    expect(await screen.findByText('Not quite.')).toBeInTheDocument()
    expect(screen.getByText('large')).toBeInTheDocument()
    // Nothing is saved until Continue.
    expect(await progressOf(repository, file.id, 'big')).toBeUndefined()
    // As after Tab: the button about to disappear has the focus (fireEvent.click moves none).
    const overruleButton = screen.getByRole('button', { name: 'I was right' })
    overruleButton.focus()
    fireEvent.click(overruleButton)
    expect(screen.getByText('Counted as correct.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    // Right at level 0 → level 1, so not learned yet; the only term was asked, so the round ends.
    expect(await screen.findByRole('heading', { name: 'Round 1 done' })).toBeInTheDocument()
    expect(screen.getByText('0 / 1 learned')).toBeInTheDocument()
    await waitFor(async () =>
      expect(await progressOf(repository, file.id, 'big')).toMatchObject({
        correctCount: 1,
        wrongCount: 0,
      }),
    )
  })

  it('after a failed save, stays on the question until Retry stores it once', async () => {
    const { repository, file, wordOf } = await setUp(TWO)
    const real = repository.recordAnswer.bind(repository)
    // Stored, but the reply is lost: the worst case for a retry (#51).
    vi.spyOn(repository, 'recordAnswer').mockImplementationOnce(async (answer) => {
      await real(answer)
      throw new ConnectionError()
    })
    renderAt(repository, `/files/${file.id}/learn`)
    const word = wordOf.get(await asked())!
    fireEvent.click(screen.getByRole('button', { name: word }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Your answer could not be saved. Check your connection')
    expect(screen.getByText('0 / 2 learned')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: /chạy|đi bộ/ })).toHaveTextContent(
      [...wordOf].find(([, w]) => w === word)![0],
    )
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }))

    await screen.findByText('Correct!')
    expect(await progressOf(repository, file.id, word)).toMatchObject({ correctCount: 1 })
  })

  it('Stop shows what was done so far, with a way back to the list', async () => {
    const { repository, file, wordOf } = await setUp(TWO)
    renderAt(repository, `/files/${file.id}/learn`)
    await answerRight(wordOf)
    fireEvent.click(await screen.findByRole('button', { name: 'Stop' }))

    expect(await screen.findByRole('heading', { name: 'Session stopped' })).toBeInTheDocument()
    expect(screen.getByText('1 answer: 1 right, 0 wrong.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Missed most' })).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: 'Back to list' }))
    expect(await screen.findByRole('heading', { name: 'Unit 1' })).toBeInTheDocument()
  })

  it('lists the most missed terms at the end', async () => {
    const { repository, file, wordOf } = await setUp([{ word: 'big', meaning: 'to' }])
    renderAt(repository, `/files/${file.id}/learn`)
    await asked()
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    // The only term of the round comes right back; right this time ends the round at level 1.
    await answerRight(wordOf)
    fireEvent.click(await screen.findByRole('button', { name: 'Next round' }))
    await answerRight(wordOf)

    expect(await screen.findByRole('heading', { name: 'You learned all 1 term!' })).toBeVisible()
    const missed = screen.getByRole('list', { name: 'Missed most' })
    expect(missed).toHaveTextContent('big')
    expect(missed).toHaveTextContent('2 right · 1 wrong')
    // Missed this session: no box up.
    expect(await progressOf(repository, file.id, 'big')).toMatchObject({ box: 1, wrongCount: 1 })
  })

  it('an empty file has nothing to learn', async () => {
    const { repository, file } = await setUp([])
    renderAt(repository, `/files/${file.id}`)
    expect(await screen.findByText('Add some terms to start learning.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Learn' })).toBeNull()

    // The same sentence was on the file page: wait for what only the Learn page has.
    window.location.hash = `#/files/${file.id}/learn`
    await screen.findByRole('link', { name: 'Back to list' })
    expect(screen.getByText('Add some terms to start learning.')).toBeInTheDocument()
  })

  it('a missing file shows "no longer exists"', async () => {
    const { repository } = await setUp([])
    renderAt(repository, `/files/${MISSING_ID}/learn`)
    expect(
      await screen.findByRole('heading', { name: 'This file no longer exists.' }),
    ).toBeVisible()
  })
})
