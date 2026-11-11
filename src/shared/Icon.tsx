/**
 * Hand-drawn SVG icons (docs/design.md#icon): emoji look different on every system, and a handful
 * of icons is not worth a library. Always decorative; the button around it carries the name.
 */
const PATHS = {
  speaker: 'M11 5 6 9H3v6h3l5 4V5Z M15.5 8.5a5 5 0 0 1 0 7 M18.5 5.5a9 9 0 0 1 0 13',
  more: 'M5 12h.01 M12 12h.01 M19 12h.01',
  chevronLeft: 'm15 18-6-6 6-6',
  chevronRight: 'm9 18 6-6-6-6',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
