// @vitest-environment node
import Dexie from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { TermSchema } from '../domain/schemas.ts'
import { DB_NAME, VocabDb } from './db.ts'

const FILE = '00000000-0000-4000-8000-0000000000f1'
const WITH_PART = '00000000-0000-4000-8000-0000000000a1'
const WITHOUT_PART = '00000000-0000-4000-8000-0000000000a2'
const STAMP = '2026-10-22T07:00:00.000Z'

/** Terms as version 5 stored them, written by the released schema (no upgrade of its own). */
async function storeVersion5(indexedDB: IDBFactory) {
  const v5 = new Dexie(DB_NAME, { indexedDB, IDBKeyRange })
  v5.version(5).stores({
    folders: 'id, &nameKey',
    files: 'id, folderId, &[folderId+nameKey]',
    terms: 'id, fileId, wordKey',
    progress: 'termId',
    studyDays: 'date',
    meta: 'key',
  })
  await v5.table('terms').bulkAdd([
    {
      id: WITH_PART,
      fileId: FILE,
      word: 'run',
      wordKey: 'run',
      partOfSpeech: 'verb',
      meaning: 'chạy',
      createdAt: STAMP,
      updatedAt: STAMP,
    },
    {
      id: WITHOUT_PART,
      fileId: FILE,
      word: 'swim',
      wordKey: 'swim',
      meaning: 'bơi',
      createdAt: STAMP,
      updatedAt: STAMP,
    },
  ])
  v5.close()
}

describe('Dexie version 6 upgrade', () => {
  it('turns partOfSpeech into a list and marks every existing term as a word (#90)', async () => {
    const indexedDB = new IDBFactory()
    await storeVersion5(indexedDB)

    const db = new VocabDb({ indexedDB, IDBKeyRange })
    await db.open()
    expect(db.verno).toBe(6)
    const rows = new Map((await db.terms.toArray()).map((row) => [row.id, row]))

    const run = rows.get(WITH_PART)
    expect(run).toMatchObject({ kind: 'word', partsOfSpeech: ['verb'] })
    expect(run).not.toHaveProperty('partOfSpeech')
    expect(rows.get(WITHOUT_PART)).toMatchObject({ kind: 'word', partsOfSpeech: [] })
    expect(rows.get(WITHOUT_PART)).not.toHaveProperty('partOfSpeech')
    db.close()
  })

  it('leaves converted rows valid under the current schema', async () => {
    const indexedDB = new IDBFactory()
    await storeVersion5(indexedDB)
    const db = new VocabDb({ indexedDB, IDBKeyRange })
    await db.open()
    for (const { wordKey: _, ...term } of await db.terms.toArray()) {
      // Parsing must change nothing: the upgrade stores the normalized shape already.
      expect(TermSchema.parse(term)).toEqual(term)
    }
    db.close()
  })
})
