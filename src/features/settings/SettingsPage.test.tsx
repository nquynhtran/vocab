import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../app/App.tsx'
import { openTestRepository, renderAppAt } from '../../app/testApp.tsx'
import { unusedLookup } from '../../app/testLookups.ts'
import { SignOutContext } from '../../shared/signOutContext.ts'
import { THEME_STORAGE_KEY } from '../../shared/theme.ts'

afterEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
  window.location.hash = ''
})

describe('Settings', () => {
  it('is reached from the header, and Home no longer holds the backup', async () => {
    renderAppAt('/', openTestRepository())
    await screen.findByText(/No folders yet/)
    expect(screen.queryByRole('button', { name: 'Export JSON' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'Settings' }))

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export JSON' })).toBeInTheDocument()
    expect(screen.getByLabelText('Backup file')).toBeInTheDocument()
  })

  it('switches the theme at once and keeps it on this device', async () => {
    renderAppAt('/settings', openTestRepository())
    expect(await screen.findByRole('radio', { name: 'System' })).toBeChecked()

    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')

    fireEvent.click(screen.getByRole('radio', { name: 'System' }))
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it('shows the stored choice when opened', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    renderAppAt('/settings', openTestRepository())
    expect(await screen.findByRole('radio', { name: 'Light' })).toBeChecked()
  })

  it('signs out from the Account section', async () => {
    const signOut = vi.fn(async () => {})
    window.location.hash = '#/settings'
    render(
      <SignOutContext value={signOut}>
        <App repository={openTestRepository()} lookup={unusedLookup} />
      </SignOutContext>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
    expect(signOut).toHaveBeenCalledOnce()
  })

  it('has no Account section without a signed-in session', async () => {
    renderAppAt('/settings', openTestRepository())
    await screen.findByRole('heading', { name: 'Settings' })
    expect(screen.queryByRole('heading', { name: 'Account' })).not.toBeInTheDocument()
  })
})
