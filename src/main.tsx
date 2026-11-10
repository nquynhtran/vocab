import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './app/App.tsx'
import { AuthGate } from './app/AuthGate.tsx'
import { ReloadNotice } from './app/ReloadNotice.tsx'
import { lastOutdatedReload, rememberOutdatedReload, shouldAutoReload } from './app/reload.ts'
import { SupabaseAuth } from './data/supabaseAuth.ts'
import { isClientOutdated } from './data/clientVersion.ts'
import { defaultDeps } from './data/deps.ts'
import { createSupabaseClient } from './data/supabaseClient.ts'
import { SupabaseRepository } from './data/supabaseRepository.ts'
import { createWiktionaryLookup } from './data/wiktionary.ts'

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

const client = createSupabaseClient()
const auth = new SupabaseAuth(client)
const expireSession = () => void auth.expireSession()
const repository = new SupabaseRepository(client, defaultDeps, expireSession)
const lookup = createWiktionaryLookup()
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
      <App repository={repository} lookup={lookup} />
    </AuthGate>
  </StrictMode>,
)

// Opened although the cloud build stores nothing in it: a tab still running an older build then
// gets versionchange and reloads (decision #33). The db closes itself. Dexie comes in a file of its
// own, fetched alongside the first render instead of before it: nothing on screen needs it (#84).
import('./data/db.ts')
  .then(({ VocabDb }) => new VocabDb({ onVersionChange: () => replaceAppAndReload() }).open())
  .catch((error: unknown) => console.error('Could not load or open IndexedDB', error))
