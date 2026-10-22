import { createContext, useContext } from 'react'
import type { Repository } from '../data/repository.ts'

/**
 * Dependency injection for storage: `main.tsx` provides the Dexie repository, tests may
 * provide another. Lives in shared/, not app/, so features can use it without importing app/.
 */
export const RepositoryContext = createContext<Repository | null>(null)

export function useRepository(): Repository {
  const repository = useContext(RepositoryContext)
  if (!repository) throw new Error('useRepository must be used inside <RepositoryContext>')
  return repository
}
