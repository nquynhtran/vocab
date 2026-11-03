import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RowMenu } from './RowMenu.tsx'

function renderMenu() {
  const rename = vi.fn()
  const remove = vi.fn()
  render(
    <>
      <RowMenu
        name="IELTS"
        actions={[
          { label: 'Rename', accessibleName: 'Rename folder "IELTS"', onSelect: rename },
          {
            label: 'Delete',
            accessibleName: 'Delete folder "IELTS"',
            danger: true,
            onSelect: remove,
          },
        ]}
      />
      <input aria-label="Elsewhere" />
    </>,
  )
  const trigger = screen.getByRole('button', { name: 'More actions for "IELTS"' })
  return { rename, remove, trigger }
}

const menu = () => screen.queryByRole('menu')
const item = (name: string) => screen.getByRole('menuitem', { name })
/** A tap or mouse click; Enter and Space give a click with `detail` 0. */
const POINTER = { detail: 1 }

describe('RowMenu', () => {
  it('opens on a click, runs the chosen action and closes, focus back on ⋯', () => {
    const { remove, rename, trigger } = renderMenu()
    expect(menu()).toBeNull()
    fireEvent.click(trigger, POINTER)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(item('Rename folder "IELTS"')).toHaveTextContent('Rename')

    fireEvent.click(item('Delete folder "IELTS"'), POINTER)
    expect(remove).toHaveBeenCalledOnce()
    expect(rename).not.toHaveBeenCalled()
    expect(menu()).toBeNull()
    expect(trigger).toHaveFocus()
  })

  it('opened from the keyboard, focuses the first item; arrows move and wrap', () => {
    const { trigger } = renderMenu()
    trigger.focus()
    fireEvent.click(trigger) // Enter or Space
    expect(item('Rename folder "IELTS"')).toHaveFocus()
    fireEvent.keyDown(item('Rename folder "IELTS"'), { key: 'ArrowDown' })
    expect(item('Delete folder "IELTS"')).toHaveFocus()
    fireEvent.keyDown(item('Delete folder "IELTS"'), { key: 'ArrowDown' })
    expect(item('Rename folder "IELTS"')).toHaveFocus()
    fireEvent.keyDown(item('Rename folder "IELTS"'), { key: 'ArrowUp' })
    expect(item('Delete folder "IELTS"')).toHaveFocus()
  })

  it('ArrowDown on ⋯ opens the menu, or enters it when opened by pointer', () => {
    const { trigger } = renderMenu()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(item('Rename folder "IELTS"')).toHaveFocus()

    fireEvent.keyDown(item('Rename folder "IELTS"'), { key: 'Escape' })
    fireEvent.click(trigger, POINTER)
    expect(trigger).toHaveFocus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(item('Rename folder "IELTS"')).toHaveFocus()
  })

  it('Escape closes and gives the focus back to ⋯, from an item or from ⋯', () => {
    const { trigger } = renderMenu()
    trigger.focus()
    fireEvent.click(trigger)
    fireEvent.keyDown(item('Rename folder "IELTS"'), { key: 'Escape' })
    expect(menu()).toBeNull()
    expect(trigger).toHaveFocus()

    fireEvent.click(trigger, POINTER)
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(menu()).toBeNull()
  })

  it('a click outside closes it, a click inside does not', () => {
    const { trigger } = renderMenu()
    fireEvent.click(trigger, POINTER)
    fireEvent.pointerDown(item('Rename folder "IELTS"'))
    expect(menu()).not.toBeNull()
    fireEvent.pointerDown(screen.getByLabelText('Elsewhere'))
    expect(menu()).toBeNull()
  })

  it('closes when the focus leaves it, from an item or from ⋯', () => {
    const { trigger } = renderMenu()
    const elsewhere = screen.getByLabelText('Elsewhere')
    fireEvent.click(trigger)
    fireEvent.blur(item('Rename folder "IELTS"'), { relatedTarget: elsewhere })
    expect(menu()).toBeNull()

    fireEvent.click(trigger, POINTER)
    fireEvent.blur(trigger, { relatedTarget: elsewhere })
    expect(menu()).toBeNull()
  })

  it('stays open while the focus moves inside, or goes nowhere (a press on an item in Safari)', () => {
    const { trigger } = renderMenu()
    fireEvent.click(trigger)
    fireEvent.blur(item('Rename folder "IELTS"'), {
      relatedTarget: item('Delete folder "IELTS"'),
    })
    fireEvent.blur(item('Delete folder "IELTS"'), { relatedTarget: null })
    expect(menu()).not.toBeNull()
  })

  it('takes the focus on a pointer click, which Safari does not give a button', () => {
    const { trigger } = renderMenu()
    expect(trigger).not.toHaveFocus()
    fireEvent.click(trigger, POINTER)
    expect(trigger).toHaveFocus()
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(menu()).toBeNull()
  })
})
