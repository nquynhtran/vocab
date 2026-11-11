import { useEffect, useRef, useState } from 'react'

/**
 * A form kept behind a "+ New …" button (decision #86). Closing it puts focus back on the button,
 * so keyboard users land where they were. `autoFocus` is only for a form the user just asked for:
 * one open from the start (an empty file) must not pop up the phone keyboard on arrival.
 */
export function useRevealedForm(initiallyOpen = false) {
  const [state, setState] = useState<'closed' | 'initial' | 'requested'>(
    initiallyOpen ? 'initial' : 'closed',
  )
  const buttonRef = useRef<HTMLButtonElement>(null)
  // Only after the form closes, not on the first render.
  const returnFocus = useRef(false)

  useEffect(() => {
    if (state !== 'closed' || !returnFocus.current) return
    returnFocus.current = false
    // Only if focus went down with the form. A slow create may finish after the user moved on,
    // e.g. to rename another item: pulling focus away from there would lose their place.
    const active = document.activeElement
    if (active === null || active === document.body) buttonRef.current?.focus()
  }, [state])

  return {
    open: state !== 'closed',
    autoFocus: state === 'requested',
    buttonRef,
    show: () => setState('requested'),
    hide: () => {
      returnFocus.current = true
      setState('closed')
    },
  }
}
