import { Link, Outlet } from 'react-router'
import { SignOutButton } from '../features/auth/SignOutButton.tsx'
import { useSignOut } from '../shared/signOutContext.ts'

export function Layout() {
  const signOut = useSignOut()
  return (
    <>
      <header className="app-header">
        <div className="app-header__inner">
          <Link to="/" className="app-header__title">
            Vocab
          </Link>
          {signOut && <SignOutButton signOut={signOut} />}
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  )
}
