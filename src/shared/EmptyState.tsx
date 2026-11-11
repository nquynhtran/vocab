import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon.tsx'

/**
 * A page or list with nothing to show: what is (not) here, why, and the one thing to do next
 * (docs/design.md, step 6). Also used for errors, with `alert` so screen readers hear them.
 */
export function EmptyState({
  icon,
  title,
  headingLevel = 2,
  alert = false,
  children,
  actions,
}: {
  icon: IconName
  title: string
  /** 1 when this is the whole page (nothing found), 2 under a page title. */
  headingLevel?: 1 | 2
  alert?: boolean
  /** One short sentence. */
  children?: ReactNode
  actions?: ReactNode
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <div className="empty-state" role={alert ? 'alert' : undefined}>
      <span className="empty-state__icon">
        <Icon name={icon} />
      </span>
      <Heading className="empty-state__title">{title}</Heading>
      {children !== undefined && <p className="muted">{children}</p>}
      {actions !== undefined && <div className="empty-state__actions">{actions}</div>}
    </div>
  )
}
