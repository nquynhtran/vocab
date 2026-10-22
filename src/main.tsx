import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './app/App.tsx'
import { ReloadNotice } from './app/ReloadNotice.tsx'
import { VocabDb } from './data/db.ts'
import { DexieRepository } from './data/dexieRepository.ts'

/** Long enough to read the notice before the page reloads. */
const RELOAD_DELAY_MS = 1500

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Missing #root element in index.html')
}
const root = createRoot(rootElement)

// Another tab opened a newer schema; the db has already closed itself (see VocabDb).
const db = new VocabDb({
  onVersionChange: () => {
    root.render(<ReloadNotice />)
    setTimeout(() => window.location.reload(), RELOAD_DELAY_MS)
  },
})

root.render(
  <StrictMode>
    <App repository={new DexieRepository(db)} />
  </StrictMode>,
)
