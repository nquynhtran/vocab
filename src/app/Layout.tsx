import { Link, Outlet } from 'react-router'
import { Icon } from '../shared/Icon.tsx'

export function Layout() {
  return (
    <>
      <header className="app-header">
        <div className="app-header__inner">
          <Link to="/" className="app-header__title">
            Vocab
          </Link>
          <Link to="/settings" className="button icon-button button--ghost" aria-label="Settings">
            <Icon name="settings" />
          </Link>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  )
}
