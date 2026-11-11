import { z } from 'zod'

/**
 * Light/dark choice of this device (docs/design.md#chế-độ-sángtối). `system` follows the device;
 * the other two put `data-theme` on <html>, which the CSS reads. `public/theme.js` does the same
 * before the first paint, so keep the key, the values and the bar colours in step with it
 * (theme.test.ts runs that file and compares).
 */
export const THEMES = ['system', 'light', 'dark'] as const
export const ThemeSchema = z.enum(THEMES).catch('system')
export type Theme = z.output<typeof ThemeSchema>

export const THEME_STORAGE_KEY = 'vocab-theme'

/** The iPhone status bar: the header's `--color-surface` of each palette. */
const BAR_COLORS = { light: '#ffffff', dark: '#1c1f26' } as const

/** `system` when nothing usable is stored or storage cannot be read (private mode). */
export function readTheme(storage: () => Storage = () => localStorage): Theme {
  try {
    return ThemeSchema.parse(storage().getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

/** Kept on this device only. A failed write still changes the theme until the page reloads. */
export function saveTheme(theme: Theme, storage: () => Storage = () => localStorage): void {
  try {
    if (theme === 'system') storage().removeItem(THEME_STORAGE_KEY)
    else storage().setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Same as a private window: nothing to keep it in.
  }
}

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  if (theme === 'system') delete root.dataset.theme
  else root.dataset.theme = theme
  // Each tag answers one media query; a fixed choice must win over both.
  for (const meta of root.ownerDocument.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  )) {
    const forDark = (meta.getAttribute('media') ?? '').includes('dark')
    meta.content = BAR_COLORS[theme === 'system' ? (forDark ? 'dark' : 'light') : theme]
  }
}
