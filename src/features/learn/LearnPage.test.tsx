import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../app/App.tsx'
import { VocabDb } from '../../data/db.ts'
import { DexieRepository } from '../../data/dexieRepository.ts'
import { ConnectionError } from '../../domain/errors.ts'
import { toAnswerRecord } from '../../domain/learn/answer.ts'
import type { TermInput } from '../../domain/schemas.ts'

const MISSING_ID = '00000000-0000-4000-8000-ffffffffffff'
/** The 0.8 s pause after a right pick, plus room for a slow CI. */
const AFTER_PAUSE = { timeout: 3000 }

/** The real page on the real repository (in-memory IndexedDB): UI and storage tested together. */
async function setUp(terms: TermInput[]) {
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

/** Two promotions on two days: box 3, so every term starts at the written question. */
async function masterAll(repository: DexieRepository, fileId: string) {
  const data = await repository.getLearnData(fileId)
  for (const term of data!.terms) {
    for (const now of ['2026-10-01T05:00:00.000Z', '2026-10-02T05:00:00.000Z']) {
      await repository.recordAnswer(toAnswerRecord(term.id, true, true, new Date(now)))
    }
  }
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
  vi.unstubAllGlobals()
  localStorage.clear()
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

    expect(await screen.findByText('0 learned · 0 familiar / 2')).toBeInTheDocument()
    // Right in multiple choice: the bar moves at once (#56).
    await answerRight(wordOf)
    expect(screen.getByText('0 learned · 1 familiar / 2')).toBeInTheDocument()
    // Each term comes back for its written question in the same round.
    await answerAllRight(wordOf)

    expect(await screen.findByRole('heading', { name: 'You learned all 2 terms!' })).toBeVisible()
    // Learned to the end: no session left to continue (#58).
    expect(localStorage.length).toBe(0)
    expect(screen.getByText('4 answers: 4 right, 0 wrong.')).toBeInTheDocument()
    expect(screen.getByText('2 learned · 0 familiar / 2')).toBeInTheDocument()
    // No mistake this session: one box up.
    expect(await progressOf(repository, file.id, 'run')).toMatchObject({
      box: 2,
      correctCount: 2,
      wrongCount: 0,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Study again' }))
    expect(await screen.findByText('0 learned · 0 familiar / 2')).toBeInTheDocument()
  })

  it('ends a round once its 7 terms are learned, then goes on with the rest', async () => {
    const terms = Array.from({ length: 8 }, (_, i) => ({ word: `w${i}`, meaning: `nghĩa ${i}` }))
    const { repository, file, wordOf } = await setUp(terms)
    await masterAll(repository, file.id)
    renderAt(repository, `/files/${file.id}/learn`)
    expect(await screen.findByText('0 learned · 8 familiar / 8')).toBeInTheDocument()
    await answerAllRight(wordOf)

    expect(await screen.findByRole('heading', { name: 'Round 1 done' })).toBeInTheDocument()
    expect(screen.getByText('7 learned · 1 familiar / 8')).toBeInTheDocument()
    expect(
      within(screen.getByRole('list', { name: 'This round' })).getAllByRole('listitem'),
    ).toHaveLength(7)
    fireEvent.click(screen.getByRole('button', { name: 'Next round' }))
    await answerAllRight(wordOf)
    expect(await screen.findByRole('heading', { name: 'You learned all 8 terms!' })).toBeVisible()
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

  it('shows the example with the word hidden in multiple choice too (#57)', async () => {
    const { repository, file } = await setUp([
      { word: 'run', meaning: 'chạy', example: 'I run every day.' },
      { word: 'walk', meaning: 'đi bộ', example: 'I walk every day.' },
    ])
    renderAt(repository, `/files/${file.id}/learn`)
    await asked()
    expect(screen.getByRole('list', { name: 'Choices' })).toBeInTheDocument()
    expect(screen.getByText('I ____ every day.')).toBeInTheDocument()
  })

  it('shows the part of speech after the meaning (#61)', async () => {
    const { repository, file } = await setUp([
      { word: 'big', partOfSpeech: 'adjective', meaning: 'to' },
    ])
    renderAt(repository, `/files/${file.id}/learn`)
    await asked()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('to adj.')
    expect(screen.getByTitle('adjective')).toHaveTextContent('adj.')
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

    // Right at level 0 → level 1, so not learned yet; the only term comes right back.
    await asked()
    expect(screen.getByText('0 learned · 1 familiar / 1')).toBeInTheDocument()
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
    expect(screen.getByText('0 learned · 0 familiar / 2')).toBeInTheDocument()
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

  it('lists the most missed terms at the end, each word read aloud on a tap', async () => {
    const speak = vi.fn()
    vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn(), getVoices: () => [] })
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        readonly text: string
        constructor(text: string) {
          this.text = text
        }
      },
    )
    const { repository, file, wordOf } = await setUp([{ word: 'big', meaning: 'to' }])
    renderAt(repository, `/files/${file.id}/learn`)
    await asked()
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    // The only term of the round comes right back, after a right answer too.
    await answerRight(wordOf)
    await answerRight(wordOf)

    expect(await screen.findByRole('heading', { name: 'You learned all 1 term!' })).toBeVisible()
    const missed = screen.getByRole('list', { name: 'Missed most' })
    expect(missed).toHaveTextContent('big')
    expect(missed).toHaveTextContent('2 right · 1 wrong')
    fireEvent.click(within(missed).getByRole('button', { name: 'Listen to "big"' }))
    expect(speak).toHaveBeenCalledWith(expect.objectContaining({ text: 'big' }))
    expect(
      screen.getByText('Terms count as mastered once you get them right on 2 different days.'),
    ).toBeInTheDocument()
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

  describe('continuing a stopped session (#58)', () => {
    /** Stop, then "Study again": the page loads afresh, as when opened later. */
    async function stopAndStudyAgain() {
      await asked()
      fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Study again' }))
    }

    it('after Stop, goes on where it stopped without asking (#63)', async () => {
      const { repository, file, wordOf } = await setUp(TWO)
      renderAt(repository, `/files/${file.id}/learn`)
      await answerRight(wordOf)
      await stopAndStudyAgain()

      expect(await screen.findByText('0 learned · 1 familiar / 2')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Continue|Start over/ })).toBeNull()
      await answerAllRight(wordOf)
      // Three more answers: the stopped session went on, it did not start again.
      expect(await screen.findByText('4 answers: 4 right, 0 wrong.')).toBeInTheDocument()
    })

    it('leaves the saved copy as it was when resumed and stopped without an answer', async () => {
      const { repository, file, wordOf } = await setUp(TWO)
      renderAt(repository, `/files/${file.id}/learn`)
      await answerRight(wordOf)
      const key = `vocab-learn:${file.id}`
      const saved = JSON.parse(localStorage.getItem(key)!) as { savedAt: string }
      const longAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      localStorage.setItem(key, JSON.stringify({ ...saved, savedAt: longAgo }))

      await stopAndStudyAgain()
      await stopAndStudyAgain()
      expect(await screen.findByText('0 learned · 1 familiar / 2')).toBeInTheDocument()
      expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({ savedAt: longAgo })
    })

    it('forgets a copy with nothing left to continue, so adding a term cannot revive it', async () => {
      const { repository, file, wordOf } = await setUp(TWO)
      renderAt(repository, `/files/${file.id}/learn`)
      await answerRight(wordOf)
      // The only answered term is deleted elsewhere: nothing worth continuing.
      const data = await repository.getLearnData(file.id)
      const answered = JSON.parse(localStorage.getItem(`vocab-learn:${file.id}`)!) as {
        answers: { termId: string }[]
      }
      const gone = data!.terms.find((t) => t.id === answered.answers[0]!.termId)!
      await repository.deleteTerm(gone.id)
      await stopAndStudyAgain()
      expect(await screen.findByText('0 learned · 0 familiar / 1')).toBeInTheDocument()
      expect(localStorage.length).toBe(0)
    })

    it('keeps nothing when nothing was answered', async () => {
      const { repository, file } = await setUp(TWO)
      renderAt(repository, `/files/${file.id}/learn`)
      await stopAndStudyAgain()
      expect(await screen.findByText('0 learned · 0 familiar / 2')).toBeInTheDocument()
      expect(localStorage.length).toBe(0)
    })

    it('learns as before when storage cannot be used', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError')
      })
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError')
      })
      const { repository, file, wordOf } = await setUp(TWO)
      renderAt(repository, `/files/${file.id}/learn`)
      await answerRight(wordOf)
      await stopAndStudyAgain()
      expect(await screen.findByText('0 learned · 0 familiar / 2')).toBeInTheDocument()
    })

    it('forgets the older copy when a later save fails, rather than going back to it', async () => {
      const { repository, file, wordOf } = await setUp(TWO)
      renderAt(repository, `/files/${file.id}/learn`)
      await answerRight(wordOf)
      expect(localStorage.length).toBe(1)
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError')
      })
      await answerRight(wordOf)
      expect(localStorage.length).toBe(0)
      await stopAndStudyAgain()
      expect(await screen.findByText('0 learned · 0 familiar / 2')).toBeInTheDocument()
    })
  })
})
