import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChoiceQuestion } from './ChoiceQuestion.tsx'

const question = {
  kind: 'choice' as const,
  termId: '00000000-0000-4000-8000-000000000001',
  meaning: 'chạy',
  word: 'run',
  choices: ['walk', 'run', 'swim'],
}

describe('ChoiceQuestion', () => {
  it('picks the option with that number', () => {
    const onPick = vi.fn()
    render(<ChoiceQuestion question={question} onPick={onPick} />)
    fireEvent.keyDown(window, { key: '2' })
    expect(onPick).toHaveBeenCalledWith('run')
  })

  it('ignores digits typed in a text box, e.g. a password in the sign-in box over Learn', () => {
    const onPick = vi.fn()
    render(
      <>
        <input aria-label="Password" />
        <ChoiceQuestion question={question} onPick={onPick} />
      </>,
    )
    fireEvent.keyDown(screen.getByLabelText('Password'), { key: '1' })
    fireEvent.keyDown(window, { key: '1', ctrlKey: true })
    fireEvent.keyDown(window, { key: '1', repeat: true })
    fireEvent.keyDown(window, { key: '4' })
    expect(onPick).not.toHaveBeenCalled()
  })

  it('ignores keys while the page is inert under the sign-in dialog', () => {
    const onPick = vi.fn()
    render(
      <div inert>
        <ChoiceQuestion question={question} onPick={onPick} />
      </div>,
    )
    fireEvent.keyDown(window, { key: '1' })
    expect(onPick).not.toHaveBeenCalled()
  })

  it('locks the options once picked, marking the right word and a wrong pick', () => {
    render(<ChoiceQuestion question={question} picked="walk" />)
    const walk = screen.getByRole('button', { name: 'walk' })
    expect(walk).toBeDisabled()
    expect(walk).toHaveClass('choice--wrong')
    expect(screen.getByRole('button', { name: 'run' })).toHaveClass('choice--right')
    expect(screen.getByRole('button', { name: 'swim' })).not.toHaveClass('choice--right')
  })
})
