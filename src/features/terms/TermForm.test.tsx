import { act, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openTestRepository, renderAppAt, seedFile } from '../../app/testApp.tsx'
import { manualLookup } from '../../app/testLookups.ts'
import { LookupFailedError } from '../../data/wiktionary.ts'
import type { TermInput } from '../../domain/schemas.ts'

async function openFilePage(terms: TermInput[] = []) {
  const repository = openTestRepository()
  const { file } = await seedFile(repository)
  for (const term of terms) await repository.createTerm(file.id, term)
  const { lookup, calls } = manualLookup()
  renderAppAt(`/files/${file.id}`, repository, lookup)
  await screen.findByRole('heading', { name: 'Unit 1' })
  return { repository, file, calls }
}

function typeInto(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

const pronunciationBox = () => screen.getByLabelText('Pronunciation (optional)')
const lookUpButton = () => screen.getByRole('button', { name: /^Look(ing)? up/ })

/** The status line under Pronunciation (the Term field has its own for duplicates). */
function lookupStatus() {
  const id = pronunciationBox().getAttribute('aria-describedby')?.split(' ').at(-1)
  return document.getElementById(id ?? '')!
}

afterEach(() => {
  vi.restoreAllMocks()
  window.location.hash = ''
})

describe('pronunciation', () => {
  it('fills the box from Look up, then shows it in the list after Add', async () => {
    const { calls } = await openFilePage()
    expect(lookUpButton()).toBeDisabled()
    typeInto('Term', 'schedule')

    fireEvent.click(lookUpButton())
    expect(lookUpButton()).toHaveTextContent('Looking up…')
    expect(lookUpButton()).toBeDisabled()
    expect(calls.map((call) => call.word)).toEqual(['schedule'])
    await act(async () => calls[0]!.resolve({ kind: 'found', pronunciation: '/ˈʃedʒuːl/' }))

    expect(pronunciationBox()).toHaveValue('/ˈʃedʒuːl/')
    expect(lookUpButton()).toHaveTextContent('Look up')
    typeInto('Meaning', 'lịch trình')
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    const row = (await screen.findByText('schedule', { selector: '.term__word' })).closest('li')!
    expect(within(row).getByText('/ˈʃedʒuːl/')).toHaveClass('pronunciation')
    expect(pronunciationBox()).toHaveValue('')
  })

  it('saves a pronunciation typed by hand, exactly as typed', async () => {
    const { repository, file } = await openFilePage()
    typeInto('Term', 'run')
    typeInto('Pronunciation (optional)', ' rʌn ')
    typeInto('Meaning', 'chạy')
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await screen.findByText('rʌn', { selector: '.pronunciation' })
    expect((await repository.listTerms(file.id))[0]?.pronunciation).toBe('rʌn')
  })

  it.each([
    ['not found', { kind: 'not-found' } as const, 'No pronunciation found.'],
    ['failed', new LookupFailedError(), "Couldn't reach the dictionary. Type it in or try again."],
  ])(
    'says when the lookup %s, with a Cambridge link, without blocking Add',
    async (_, outcome, message) => {
      const { calls } = await openFilePage()
      typeInto('Term', 'give up')
      fireEvent.click(lookUpButton())
      await act(async () =>
        outcome instanceof Error ? calls[0]!.reject(outcome) : calls[0]!.resolve(outcome),
      )

      expect(lookupStatus()).toHaveTextContent(message)
      const link = within(lookupStatus()).getByRole('link', {
        name: 'Search Cambridge Dictionary ↗',
      })
      expect(link).toHaveAttribute(
        'href',
        'https://dictionary.cambridge.org/search/english/direct/?q=give%20up',
      )
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')

      typeInto('Meaning', 'từ bỏ')
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))
      await screen.findByText('give up', { selector: '.term__word' })
      expect(lookupStatus()).toBeEmptyDOMElement()
    },
  )

  it('clears the message when Term changes', async () => {
    const { calls } = await openFilePage()
    typeInto('Term', 'give up')
    fireEvent.click(lookUpButton())
    await act(async () => calls[0]!.resolve({ kind: 'not-found' }))
    typeInto('Term', 'give in')
    expect(lookupStatus()).toBeEmptyDOMElement()
  })

  it('never overwrites what was typed in Pronunciation while the lookup was pending', async () => {
    const { calls } = await openFilePage()
    typeInto('Term', 'run')
    fireEvent.click(lookUpButton())
    typeInto('Pronunciation (optional)', '/rʌn/ (mine)')

    expect(calls[0]!.signal?.aborted).toBe(true)
    await act(async () => calls[0]!.resolve({ kind: 'found', pronunciation: '/rʌn/' }))
    expect(pronunciationBox()).toHaveValue('/rʌn/ (mine)')
    expect(lookUpButton()).toHaveTextContent('Look up')
  })

  it('drops a result for a word that was changed while the lookup was pending', async () => {
    const { calls } = await openFilePage()
    typeInto('Term', 'run')
    fireEvent.click(lookUpButton())
    typeInto('Term', 'walk')

    expect(calls[0]!.signal?.aborted).toBe(true)
    await act(async () => calls[0]!.resolve({ kind: 'found', pronunciation: '/rʌn/' }))
    expect(pronunciationBox()).toHaveValue('')
  })

  it('drops a result that comes back after the term was added', async () => {
    const { calls } = await openFilePage()
    typeInto('Term', 'run')
    typeInto('Meaning', 'chạy')
    fireEvent.click(lookUpButton())
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await screen.findByText('run', { selector: '.term__word' })

    await act(async () => calls[0]!.resolve({ kind: 'found', pronunciation: '/rʌn/' }))
    expect(pronunciationBox()).toHaveValue('')
    expect(lookupStatus()).toBeEmptyDOMElement()
  })

  it('keeps the pronunciation when another field of the term is edited', async () => {
    const { repository, file } = await openFilePage([
      { word: 'run', pronunciation: '/rʌn/', meaning: 'chạy' },
    ])
    fireEvent.click(await screen.findByRole('button', { name: 'More actions for "run"' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit "run"' }))
    const form = within(screen.getByRole('button', { name: 'Save' }).closest('li')!)
    expect(form.getByLabelText('Pronunciation (optional)')).toHaveValue('/rʌn/')

    fireEvent.change(form.getByLabelText('Meaning'), { target: { value: 'chạy bộ' } })
    fireEvent.click(form.getByRole('button', { name: 'Save' }))

    await screen.findByText('chạy bộ')
    expect((await repository.listTerms(file.id))[0]).toMatchObject({
      meaning: 'chạy bộ',
      pronunciation: '/rʌn/',
    })
  })
})
