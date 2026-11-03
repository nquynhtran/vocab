import { render } from '@testing-library/react'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { VocabDb } from '../data/db.ts'
import { DexieRepository } from '../data/dexieRepository.ts'
import type { Repository } from '../data/repository.ts'
import type { PronunciationLookup } from '../data/wiktionary.ts'
import { App } from './App.tsx'
import { unusedLookup } from './testLookups.ts'

/** The real repository on an in-memory IndexedDB, so UI tests cover storage too. */
export function openTestRepository(indexedDB = new IDBFactory()): DexieRepository {
  return new DexieRepository(new VocabDb({ indexedDB, IDBKeyRange }))
}

/** The whole app at `path`, as a user would open it. */
export function renderAppAt(
  path: string,
  repository: Repository,
  lookup: PronunciationLookup = unusedLookup,
) {
  window.location.hash = `#${path}`
  return render(<App repository={repository} lookup={lookup} />)
}

/** A folder "IELTS" with an empty file "Unit 1". */
export async function seedFile(repository: Repository) {
  const folder = await repository.createFolder({ name: 'IELTS' })
  const file = await repository.createFile(folder.id, { name: 'Unit 1' })
  return { folder, file }
}
