import { afterEach, describe, expect, it } from 'vitest'
import { applyTheme, readTheme, saveTheme, THEME_STORAGE_KEY } from './theme.ts'

function addBarColors() {
  document.head.innerHTML =
    '<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">' +
    '<meta name="theme-color" content="#1c1f26" media="(prefers-color-scheme: dark)">'
}

const barColors = () =>
  [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((m) => m.content)

const failingStorage = () => {
  throw new DOMException('blocked', 'SecurityError')
}

afterEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
  document.head.innerHTML = ''
})

describe('theme', () => {
  it('follows the device when nothing, or nothing known, is stored', () => {
    expect(readTheme()).toBe('system')
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia')
    expect(readTheme()).toBe('system')
  })

  it('keeps a choice, and forgets it when going back to the device', () => {
    saveTheme('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(readTheme()).toBe('dark')
    saveTheme('system')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it('works without storage, as in a private window', () => {
    expect(readTheme(failingStorage)).toBe('system')
    expect(() => saveTheme('dark', failingStorage)).not.toThrow()
  })

  it('sets the palette and the status bar colour, and gives both back to the device', () => {
    addBarColors()
    applyTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(barColors()).toStrictEqual(['#1c1f26', '#1c1f26'])

    applyTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(barColors()).toStrictEqual(['#ffffff', '#ffffff'])

    applyTheme('system')
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(barColors()).toStrictEqual(['#ffffff', '#1c1f26'])
  })
})
