import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

export interface RowMenuAction {
  /** Shown in the menu. */
  label: string
  /** Names the row too, e.g. `Delete folder "IELTS"`, for screen readers and tests. */
  accessibleName: string
  danger?: boolean
  onSelect: () => void
}

/**
 * The ⋯ button of a row and its small menu (#59). Hand-written: `popover` needs iOS 17.
 * Escape, Tab or a click outside closes it; Escape also gives the focus back to ⋯. Opened from the
 * keyboard, the first item gets the focus and the arrow keys move between items.
 */
export function RowMenu({ name, actions }: { name: string; actions: readonly RowMenuAction[] }) {
  const [open, setOpen] = useState<false | 'pointer' | 'keyboard'>(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    if (open === 'keyboard') items(menuRef.current)[0]?.focus()
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  function handleMenuKey(event: KeyboardEvent) {
    const list = items(menuRef.current)
    const at = list.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      list[(at + step + list.length) % list.length]?.focus()
    }
  }

  return (
    <div
      ref={containerRef}
      className="row-menu"
      // Tab (from ⋯ or an item) closes it. No `relatedTarget` means a press on something that
      // takes no focus, Safari's buttons included: closing then would swallow a click on an
      // item, and a press outside is already handled by the pointerdown listener.
      onBlur={(event) => {
        const next = event.relatedTarget
        if (open && next instanceof Node && !event.currentTarget.contains(next)) setOpen(false)
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="button icon-button"
        aria-label={`More actions for "${name}"`}
        aria-haspopup="menu"
        aria-expanded={open !== false}
        aria-controls={open ? menuId : undefined}
        // A click from Enter or Space has no pointer position: `detail` is 0.
        onClick={(event) => {
          // Safari does not focus a clicked button; without the focus, Escape and the arrows
          // would never reach the handler below.
          event.currentTarget.focus()
          setOpen(open ? false : event.detail === 0 ? 'keyboard' : 'pointer')
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.preventDefault()
            setOpen(false)
          } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            if (open) items(menuRef.current)[0]?.focus()
            else setOpen('keyboard')
          }
        }}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <ul
          ref={menuRef}
          id={menuId}
          className="row-menu__list"
          role="menu"
          aria-label={`Actions for "${name}"`}
          onKeyDown={handleMenuKey}
        >
          {actions.map((action) => (
            <li key={action.label} role="none">
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={action.danger ? 'row-menu__item button--danger' : 'row-menu__item'}
                aria-label={action.accessibleName}
                onClick={() => {
                  close()
                  action.onSelect()
                }}
              >
                {action.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function items(menu: HTMLUListElement | null): HTMLButtonElement[] {
  return menu ? [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')] : []
}
