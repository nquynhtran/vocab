// Runs in <head> before the page paints, so a light/dark choice made in Settings shows at once,
// without a flash of the other palette (docs/design.md). A file, not an inline script: the CSP
// allows scripts from 'self' only. Keep the key, values and colours in step with
// src/shared/theme.ts, which applies the same after a change.
try {
  var theme = localStorage.getItem('vocab-theme')
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme
    var bar = theme === 'dark' ? '#1c1f26' : '#ffffff'
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (meta) {
      meta.content = bar
    })
  }
} catch {
  // Storage blocked (private mode): follow the device.
}
