import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './app/App.tsx'
import { AuthGate } from './app/AuthGate.tsx'
import { ReloadNotice } from './app/ReloadNotice.tsx'
import { lastOutdatedReload, rememberOutdatedReload, shouldAutoReload } from './app/reload.ts'
import { SupabaseAuth } from './data/auth.ts'
import { isClientOutdated } from './data/clientVersion.ts'
import { VocabDb } from './data/db.ts'
import { defaultDeps } from './data/deps.ts'
import { createSupabaseClient } from './data/supabaseClient.ts'
import { SupabaseRepository } from './data/supabaseRepository.ts'

/** Long enough to read the notice before the page reloads. */
const RELOAD_DELAY_MS = 1500

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Missing #root element in index.html')
}
const root = createRoot(rootElement)

let replaced = false
function replaceAppAndReload(automatic = true) {
  if (replaced) return
  replaced = true
  root.render(<ReloadNotice automatic={automatic} />)
  if (automatic) setTimeout(() => window.location.reload(), RELOAD_DELAY_MS)
}

// Opened right away although the cloud build stores nothing in it yet: a tab still running the
// local-only build then gets versionchange and reloads (decision #33). The db closes itself.
const db = new VocabDb({ onVersionChange: () => replaceAppAndReload() })
db.open().catch((error: unknown) => console.error('Could not open IndexedDB', error))

const client = createSupabaseClient()
const auth = new SupabaseAuth(client)
const expireSession = () => void auth.expireSession()
const repository = new SupabaseRepository(client, defaultDeps, expireSession)
const isOutdated = () => isClientOutdated(client, expireSession)

function handleOutdated() {
  const now = Date.now()
  const automatic = shouldAutoReload(lastOutdatedReload(), now)
  if (automatic) rememberOutdatedReload(now)
  replaceAppAndReload(automatic)
}

root.render(
  <StrictMode>
    <AuthGate auth={auth} isOutdated={isOutdated} onOutdated={handleOutdated}>
      <App repository={repository} />
    </AuthGate>
  </StrictMode>,
)
