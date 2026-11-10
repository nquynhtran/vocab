import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { describe, expect, it, vi } from 'vitest'
import type { Auth, AuthListener, SignInInput } from '../data/auth.ts'
import { VocabDb } from '../data/db.ts'
import { DexieRepository } from '../data/dexieRepository.ts'
import { AuthenticationError, ConnectionError, SessionExpiredError } from '../domain/errors.ts'
import { SignOutButton } from '../features/auth/SignOutButton.tsx'
import { useSignOut } from '../shared/signOutContext.ts'
import { App } from './App.tsx'
import { unusedLookup } from './testLookups.ts'
import { AuthGate } from './AuthGate.tsx'

const PASSWORD = 'right password'

/** Signs in as whoever's email is typed, when the password is right. */
class FakeAuth implements Auth {
  private readonly listeners = new Set<AuthListener>()
  private userId: string | null

  constructor(userId: string | null = null) {
    this.userId = userId
  }

  subscribe(listener: AuthListener) {
    this.listeners.add(listener)
    queueMicrotask(() => listener(this.userId))
    return () => void this.listeners.delete(listener)
  }

  signIn = vi.fn(async ({ email, password }: SignInInput) => {
    if (password !== PASSWORD) throw new AuthenticationError('Wrong email or password.')
    this.change(email)
  })

  signOut = vi.fn(async () => this.change(null))
  expireSession = vi.fn(async () => this.change(null))

  /** Like auth-js: listeners hear about changes from any tab or from a failed refresh. */
  change(userId: string | null) {
    this.userId = userId
    act(() => this.listeners.forEach((listener) => listener(userId)))
  }
}

let mounts = 0

/** Stands in for the app: a form with unsaved text, and the header's sign-out button. */
function FakeApp() {
  const [note, setNote] = useState('')
  const signOut = useSignOut()
  useEffect(() => {
    mounts++
  }, [])
  return (
    <>
      <label htmlFor="note">Note</label>
      <input id="note" value={note} onChange={(event) => setNote(event.target.value)} />
      {signOut && <SignOutButton signOut={signOut} />}
    </>
  )
}

function renderGate({
  auth = new FakeAuth(),
  isOutdated = vi.fn(async () => false),
}: { auth?: FakeAuth; isOutdated?: () => Promise<boolean> } = {}) {
  mounts = 0
  const onOutdated = vi.fn()
  render(
    <AuthGate auth={auth} isOutdated={isOutdated} onOutdated={onOutdated}>
      <FakeApp />
    </AuthGate>,
  )
  return { auth, isOutdated, onOutdated }
}

async function signIn(email = 'me@example.com', password = PASSWORD) {
  fireEvent.change(await screen.findByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

/**
 * The dialog is gone and the app's effects have run, so `mounts` is final. The DOM changes
 * before useEffect runs, so counting right after the dialog disappeared missed a remount on a
 * slow CI run, and could not catch an unwanted one.
 */
async function dialogClosed() {
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await act(async () => {})
}

describe('AuthGate', () => {
  it('asks to sign in and shows nothing of the app before', async () => {
    renderGate()
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Note')).not.toBeInTheDocument()
  })

  it('shows the app after signing in and checking the client version', async () => {
    const { auth, isOutdated } = renderGate()
    await signIn()
    expect(await screen.findByLabelText('Note')).toBeInTheDocument()
    expect(auth.signIn).toHaveBeenCalledWith({ email: 'me@example.com', password: PASSWORD })
    expect(isOutdated).toHaveBeenCalledOnce()
  })

  it('skips the sign-in screen for a stored session', async () => {
    renderGate({ auth: new FakeAuth('me') })
    expect(await screen.findByLabelText('Note')).toBeInTheDocument()
  })

  it('keeps the sign-in screen with the error on wrong credentials', async () => {
    renderGate()
    await signIn('me@example.com', 'wrong')
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password.')
    expect(screen.queryByLabelText('Note')).not.toBeInTheDocument()
  })

  it('never shows the app to an outdated client', async () => {
    const { onOutdated } = renderGate({
      auth: new FakeAuth('me'),
      isOutdated: vi.fn(async () => true),
    })
    await waitFor(() => expect(onOutdated).toHaveBeenCalledOnce())
    expect(screen.queryByLabelText('Note')).not.toBeInTheDocument()
  })

  it('offers a retry when the version check fails at start', async () => {
    const isOutdated = vi
      .fn<() => Promise<boolean>>()
      .mockRejectedValueOnce(new ConnectionError())
      .mockResolvedValue(false)
    renderGate({ auth: new FakeAuth('me'), isOutdated })
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server.')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByLabelText('Note')).toBeInTheDocument()
  })

  it('keeps unsaved text when the session is lost and the same user signs in again', async () => {
    const { auth } = renderGate({ auth: new FakeAuth('me@example.com') })
    fireEvent.change(await screen.findByLabelText('Note'), { target: { value: 'half typed' } })

    auth.change(null)
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Sign in again with the same account')
    // Still mounted, but out of reach until signed in again.
    expect(screen.getByLabelText('Note').closest('[inert]')).not.toBeNull()

    await signIn('me@example.com')
    await dialogClosed()
    expect(screen.getByLabelText('Note')).toHaveValue('half typed')
    expect(screen.getByLabelText('Note').closest('[inert]')).toBeNull()
    expect(mounts).toBe(1)
  })

  it('checks the version again when the same user signs in again', async () => {
    const isOutdated = vi.fn<() => Promise<boolean>>().mockResolvedValueOnce(false)
    const { auth, onOutdated } = renderGate({ auth: new FakeAuth('me@example.com'), isOutdated })
    await screen.findByLabelText('Note')

    isOutdated.mockResolvedValueOnce(true)
    auth.change(null)
    await signIn('me@example.com')
    await waitFor(() => expect(onOutdated).toHaveBeenCalledOnce())
    // Never interactive again: the outdated code must not write.
    expect(screen.getByLabelText('Note').closest('[inert]')).not.toBeNull()
  })

  it('drops the error of a failed check once the session changes', async () => {
    const isOutdated = vi
      .fn<() => Promise<boolean>>()
      .mockRejectedValueOnce(new ConnectionError())
      .mockResolvedValue(false)
    const auth = new FakeAuth('me@example.com')
    renderGate({ auth, isOutdated })
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server.')

    auth.change(null)
    await signIn('me@example.com')
    expect(await screen.findByLabelText('Note')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('starts a fresh app when another user signs in', async () => {
    const { auth, isOutdated } = renderGate({ auth: new FakeAuth('me@example.com') })
    fireEvent.change(await screen.findByLabelText('Note'), { target: { value: 'private' } })
    window.location.hash = '#/files/of-the-previous-user'

    auth.change(null)
    await signIn('someone@example.com')
    await dialogClosed()
    expect(screen.getByLabelText('Note')).toHaveValue('')
    expect(window.location.hash).toBe('#/')
    expect(mounts).toBe(2)
    expect(isOutdated).toHaveBeenCalledTimes(2)
  })

  it('removes the app when the user signs out with the button', async () => {
    const { auth } = renderGate({ auth: new FakeAuth('me@example.com') })
    fireEvent.change(await screen.findByLabelText('Note'), { target: { value: 'draft' } })

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(screen.queryByLabelText('Note')).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(auth.signOut).toHaveBeenCalledOnce()

    await signIn('me@example.com')
    expect(await screen.findByLabelText('Note')).toHaveValue('')
  })

  it('removes the app even when signing out fails', async () => {
    const auth = new FakeAuth('me@example.com')
    auth.signOut.mockImplementationOnce(async () => {
      auth.change(null)
      throw new Error('server unreachable')
    })
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderGate({ auth })
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(screen.queryByLabelText('Note')).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(log).toHaveBeenCalled())
    log.mockRestore()
  })

  /**
   * The app is on screen and its effects have run. Seeing it is not enough: findBy resolves as
   * soon as the DOM changes, before useEffect adds the visibilitychange listener, so an event
   * dispatched right away was sometimes lost on a slow CI run.
   */
  async function appListening() {
    await screen.findByLabelText('Note')
    await act(async () => {})
  }

  it('checks the version again when the tab becomes visible', async () => {
    const isOutdated = vi.fn<() => Promise<boolean>>().mockResolvedValueOnce(false)
    const { onOutdated } = renderGate({ auth: new FakeAuth('me'), isOutdated })
    await appListening()

    isOutdated.mockResolvedValueOnce(true)
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => expect(onOutdated).toHaveBeenCalledOnce())
    expect(isOutdated).toHaveBeenCalledTimes(2)
  })

  it('ignores a failed check when the tab becomes visible', async () => {
    const isOutdated = vi.fn<() => Promise<boolean>>().mockResolvedValueOnce(false)
    const { onOutdated } = renderGate({ auth: new FakeAuth('me'), isOutdated })
    await appListening()

    isOutdated.mockRejectedValueOnce(new ConnectionError())
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => expect(isOutdated).toHaveBeenCalledTimes(2))
    expect(onOutdated).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Note')).toBeInTheDocument()
  })
})

describe('AuthGate over Learn', () => {
  it('keeps the session when it expires mid-answer; Retry after signing in stores it once', async () => {
    const repository = new DexieRepository(
      new VocabDb({ indexedDB: new IDBFactory(), IDBKeyRange }),
    )
    const folder = await repository.createFolder({ name: 'IELTS' })
    const file = await repository.createFile(folder.id, { name: 'Unit 1' })
    const run = await repository.createTerm(file.id, { word: 'run', meaning: 'chạy' })
    await repository.createTerm(file.id, { word: 'walk', meaning: 'đi bộ' })
    const auth = new FakeAuth('me@example.com')
    const real = repository.recordAnswer.bind(repository)
    // Like SupabaseRepository on a 401: the session is dropped and the write fails.
    const record = vi.spyOn(repository, 'recordAnswer').mockImplementationOnce(async () => {
      void auth.expireSession()
      throw new SessionExpiredError()
    })
    record.mockImplementation(real)
    window.location.hash = `#/files/${file.id}/learn`
    render(
      <AuthGate auth={auth} isOutdated={async () => false} onOutdated={vi.fn()}>
        <App repository={repository} lookup={unusedLookup} />
      </AuthGate>,
    )

    const meaning = (await screen.findByRole('heading', { level: 2 })).textContent
    const word = meaning === 'chạy' ? 'run' : 'walk'
    await act(async () => {})

    // Signed out in another tab while a question is open: a key pressed in the dialog must not
    // answer the question beneath it.
    await auth.expireSession()
    fireEvent.keyDown(await screen.findByRole('button', { name: 'Sign in' }), { key: '2' })
    await signIn('me@example.com')
    await dialogClosed()
    expect(record).not.toHaveBeenCalled()

    // The session expires again while saving: after signing in, Retry stores the answer once.
    fireEvent.click(screen.getByRole('button', { name: word }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await signIn('me@example.com')
    await dialogClosed()
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Correct!')).toBeInTheDocument()
    expect(record).toHaveBeenCalledTimes(2)
    const data = await repository.getLearnData(file.id)
    const termId = word === 'run' ? run.id : data!.terms.find((t) => t.word === 'walk')!.id
    expect(data!.progress.find((p) => p.termId === termId)).toMatchObject({ correctCount: 1 })
    window.location.hash = ''
  })
})
