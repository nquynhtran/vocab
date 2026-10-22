import { Link, Outlet } from 'react-router'

export function Layout() {
  return (
    <>
      <header className="app-header">
        <Link to="/" className="app-header__title">
          Vocab
        </Link>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  )
}
