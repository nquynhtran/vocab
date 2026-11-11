import { HashRouter, Route, Routes } from 'react-router'
import type { Repository } from '../data/repository.ts'
import type { PronunciationLookup } from '../data/wiktionary.ts'
import { FolderPage } from '../features/files/FolderPage.tsx'
import { HomePage } from '../features/folders/HomePage.tsx'
import { LearnPage } from '../features/learn/LearnPage.tsx'
import { SettingsPage } from '../features/settings/SettingsPage.tsx'
import { FilePage } from '../features/terms/FilePage.tsx'
import { NotFound } from '../shared/PageStatus.tsx'
import { PronunciationLookupContext } from '../shared/pronunciationLookupContext.ts'
import { RepositoryContext } from '../shared/repositoryContext.ts'
import { Layout } from './Layout.tsx'

// HashRouter because GitHub Pages cannot rewrite unknown paths to index.html.
export function App({
  repository,
  lookup,
}: {
  repository: Repository
  lookup: PronunciationLookup
}) {
  return (
    <RepositoryContext value={repository}>
      <PronunciationLookupContext value={lookup}>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="folders/:folderId" element={<FolderPage />} />
              <Route path="files/:fileId" element={<FilePage />} />
              <Route path="files/:fileId/learn" element={<LearnPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFound message="Page not found." />} />
            </Route>
          </Routes>
        </HashRouter>
      </PronunciationLookupContext>
    </RepositoryContext>
  )
}
