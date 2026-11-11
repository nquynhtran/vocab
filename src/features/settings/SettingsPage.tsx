import { useState } from 'react'
import { SignOutButton } from '../auth/SignOutButton.tsx'
import { BackupSection } from '../backup/BackupSection.tsx'
import { useSignOut } from '../../shared/signOutContext.ts'
import { applyTheme, readTheme, saveTheme, THEMES, type Theme } from '../../shared/theme.ts'

const THEME_LABELS: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' }

/** Things changed rarely, kept off Home so it stays about studying (decision #86). */
export function SettingsPage() {
  const signOut = useSignOut()
  return (
    <section>
      <h1>Settings</h1>
      <div className="settings">
        <AppearanceSection />
        <BackupSection />
        {signOut && (
          <section aria-labelledby="account-heading" className="settings-section">
            <h2 id="account-heading">Account</h2>
            <SignOutButton signOut={signOut} />
          </section>
        )}
      </div>
    </section>
  )
}

function AppearanceSection() {
  const [theme, setTheme] = useState(readTheme)

  function choose(next: Theme) {
    setTheme(next)
    saveTheme(next)
    applyTheme(next)
  }

  return (
    <section aria-labelledby="appearance-heading" className="settings-section">
      <h2 id="appearance-heading">Appearance</h2>
      <fieldset className="segmented">
        <legend className="visually-hidden">Theme</legend>
        {THEMES.map((option) => (
          <label key={option} className="segmented__option">
            <input
              type="radio"
              name="theme"
              value={option}
              checked={theme === option}
              onChange={() => choose(option)}
            />
            <span>{THEME_LABELS[option]}</span>
          </label>
        ))}
      </fieldset>
      <p className="muted">System follows your device. Saved on this device only.</p>
    </section>
  )
}
