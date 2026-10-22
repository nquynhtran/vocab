import { HashRouter, Route, Routes } from 'react-router'
import type { Repository } from '../data/repository.ts'
import { FolderPage } from '../features/files/FolderPage.tsx'
import { HomePage } from '../features/folders/HomePage.tsx'
import { FilePage } from '../features/terms/FilePage.tsx'
import { NotFound } from '../shared/PageStatus.tsx'
import { RepositoryContext } from '../shared/repositoryContext.ts'
import { Layout } from './Layout.tsx'

// HashRouter because GitHub Pages cannot rewrite unknown paths to index.html.
export function App({ repository }: { repository: Repository }) {
  return (
    <RepositoryContext value={repository}>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="folders/:folderId" element={<FolderPage />} />
            <Route path="files/:fileId" element={<FilePage />} />
            <Route path="*" element={<NotFound message="Page not found." />} />
          </Route>
        </Routes>
      </HashRouter>
    </RepositoryContext>
  )
}
