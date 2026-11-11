import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../shared/Icon.tsx'

/**
 * The Learn screen in place of the app layout: a slim header with only a way back to the file,
 * so nothing else (app name, Settings) pulls attention away while learning
 * (docs/design.md#bố-cục-màn-hình-kế-hoạch-86-làm-dần).
 */
export function LearnFrame({
  fileId,
  title,
  action,
  children,
}: {
  fileId: string
  /** The file name, once loaded. */
  title?: string
  /** Shown on the right, e.g. Stop. */
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <>
      <header className="app-header">
        <div className="app-header__inner learn-header">
          <Link
            to={`/files/${fileId}`}
            className="button icon-button button--ghost"
            aria-label="Back to file"
          >
            <Icon name="chevronLeft" />
          </Link>
          {title !== undefined && (
            // One line, so a long name never makes the header taller; `title` shows it in full.
            <h1 className="learn-header__title" title={title}>
              {title}
            </h1>
          )}
          {action}
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  )
}
