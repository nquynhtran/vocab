// @vitest-environment node
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  AuthenticationError,
  ConnectionError,
  DataAlreadyExistsError,
  EntityNotFoundError,
  InvalidStoredDataError,
  SessionExpiredError,
} from '../domain/errors.ts'
import type { Backup } from '../domain/backup.ts'
import { StudyDaySchema, TermProgressSchema } from '../domain/schemas.ts'
import { isClientOutdated } from './clientVersion.ts'
import { SupabaseAuth } from './supabaseAuth.ts'
import { describeRepositoryContract, testDeps, testId } from './repositoryContract.ts'
import { MAX_ROWS, SupabaseRepository } from './supabaseRepository.ts'
import { entityToRow } from './supabaseRows.ts'

const NO_SESSION = { persistSession: false, autoRefreshToken: false }

// ---- Error translation, against a fake server (runs in CI) ----

function fakeRepository(
  respond: (url: string) => Response | Promise<Response>,
  onSessionExpired?: () => void,
) {
  const client = createClient('http://fake.test', 'fake-key', {
    auth: NO_SESSION,
    global: {
      fetch: async (input) => respond(String(input instanceof Request ? input.url : input)),
    },
  })
  return new SupabaseRepository(client, testDeps(), onSessionExpired)
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const folderRow = {
  id: testId(1),
  user_id: testId(9),
  name: 'IELTS',
  name_key: 'ielts',
  created_at: '2026-10-22T08:00:00+00:00',
  updated_at: '2026-10-22T08:00:00+00:00',
}

const EMPTY_BACKUP: Backup = {
  schemaVersion: 1,
  exportedAt: '2026-10-22T08:00:00.000Z',
  folders: [],
  files: [],
  terms: [],
  progress: [],
  studyDays: [],
}

describe('SupabaseRepository errors', () => {
  it('reports a failed fetch as ConnectionError, after supabase-js retried a read', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    try {
      let attempts = 0
      const repo = fakeRepository(() => {
        attempts++
        return Promise.reject(new TypeError('fetch failed'))
      })
      // Reads (GET) are retried 3 times with 1 + 2 + 4 s of backoff; writes are never retried.
      const read = expect(repo.listFolders()).rejects.toBeInstanceOf(ConnectionError)
      await vi.runAllTimersAsync()
      await read
      expect(attempts).toBe(4)
      await expect(repo.createFolder({ name: 'IELTS' })).rejects.toBeInstanceOf(ConnectionError)
      expect(attempts).toBe(5)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports HTTP 401 as SessionExpiredError, and to onSessionExpired', async () => {
    const onSessionExpired = vi.fn()
    const repo = fakeRepository(
      () => json({ code: '42501', message: 'permission denied for table folders' }, 401),
      onSessionExpired,
    )
    await expect(repo.listFolders()).rejects.toBeInstanceOf(SessionExpiredError)
    await expect(repo.createFolder({ name: 'IELTS' })).rejects.toBeInstanceOf(SessionExpiredError)
    expect(onSessionExpired).toHaveBeenCalledTimes(2)
  })

  it('keeps the code of any other failure in the message', async () => {
    const repo = fakeRepository(() => json({ code: 'XX000', message: 'boom' }, 500))
    await expect(repo.listFolders()).rejects.toThrow('Cloud request failed (XX000): boom')
  })

  it('reports import_snapshot refusing a non-empty account as DataAlreadyExistsError', async () => {
    const repo = fakeRepository(() =>
      json({ code: 'VC001', message: 'Cloud already has data' }, 400),
    )
    await expect(repo.importIntoEmpty(EMPTY_BACKUP)).rejects.toBeInstanceOf(DataAlreadyExistsError)
  })

  it('fails the whole read on one bad row instead of skipping it', async () => {
    const repo = fakeRepository(() => json([folderRow, { ...folderRow, name: ' IELTS' }]))
    await expect(repo.listFolders()).rejects.toThrow(
      new InvalidStoredDataError('folders 1: name', 'value is not normalized'),
    )
  })

  it.each([
    ['folders', (repo: SupabaseRepository) => repo.listFolders()],
    ['files', (repo: SupabaseRepository) => repo.listFiles(testId(1))],
    ['matching terms', (repo: SupabaseRepository) => repo.findTermsByWord('run')],
  ])('refuses a list of %s cut at max_rows instead of showing part of it', async (what, list) => {
    // The guard runs before any row is parsed, so the row content does not matter here.
    const rows = Array.from({ length: MAX_ROWS }, () => folderRow)
    await expect(list(fakeRepository(() => json(rows)))).rejects.toThrow(`Too many ${what}`)
  })

  it('accepts a list just below max_rows', async () => {
    const rows = Array.from({ length: MAX_ROWS - 1 }, (_, i) => ({
      ...folderRow,
      id: testId(i + 1),
      name: `F${i}`,
      name_key: `f${i}`,
    }))
    await expect(fakeRepository(() => json(rows)).listFolders()).resolves.toHaveLength(MAX_ROWS - 1)
  })

  it('never sends an id that is not a uuid, which Postgres would reject', async () => {
    const repo = fakeRepository(() => {
      throw new Error('no request expected')
    })
    const input = { name: 'X', word: 'a', meaning: 'b' }
    expect(await repo.getFolder('nope')).toBeUndefined()
    expect(await repo.getFolderContents('nope')).toBeUndefined()
    expect(await repo.getFile('nope')).toBeUndefined()
    expect(await repo.listFiles('nope')).toEqual([])
    expect(await repo.listTerms('nope')).toEqual([])
    for (const remove of [repo.deleteFolder, repo.deleteFile, repo.deleteTerm]) {
      await expect(remove.call(repo, 'nope')).resolves.toBeUndefined()
    }
    for (const [write, kind] of [
      [() => repo.renameFolder('nope', input), 'folder'],
      [() => repo.createFile('nope', input), 'folder'],
      [() => repo.renameFile('nope', input), 'file'],
      [() => repo.createTerm('nope', input), 'file'],
      [() => repo.updateTerm('nope', input), 'term'],
    ] as const) {
      await expect(write()).rejects.toMatchObject({ constructor: EntityNotFoundError, kind })
    }
  })

  it('drops an excluded term id that is not a uuid instead of sending it', async () => {
    let url = ''
    const repo = fakeRepository((request) => {
      url = request
      return json([])
    })
    await repo.findTermsByWord('run', 'nope')
    expect(url).toContain('word_key=eq.run')
    expect(url).not.toContain('nope')
  })
})

// ---- The shared contract, against local Supabase (npm run test:supabase) ----

/** Local Supabase CLI defaults (`npx supabase status`): public values, not secrets. */
const LOCAL_URL = 'http://127.0.0.1:54321'
const LOCAL_PUBLISHABLE_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
/** Created by supabase/seed.sql, since sign-up is disabled. */
const TEST_USER = { email: 'contract@test.local', password: 'contract-test-password' }

describe.runIf(import.meta.env.VOCAB_SUPABASE_TESTS === '1')('on local Supabase', () => {
  const client = createClient(LOCAL_URL, LOCAL_PUBLISHABLE_KEY, { auth: NO_SESSION })

  beforeAll(async () => {
    const { error } = await client.auth.signInWithPassword(TEST_USER)
    if (error) throw new Error(`Sign-in failed; is local Supabase running? ${error.message}`)
  })

  describeRepositoryContract(async (deps) => {
    await clearAccount(client)
    return {
      repo: new SupabaseRepository(client, deps),
      addProgress: (rows) =>
        insert(
          client,
          'progress',
          rows.map((row) => entityToRow(TermProgressSchema, row)),
        ),
      addStudyDays: (rows) =>
        insert(
          client,
          'study_days',
          rows.map((row) => entityToRow(StudyDaySchema, row)),
        ),
    }
  })

  describe('cloud only', () => {
    it('rejects a row edited by hand into a shape the app never writes', async () => {
      await clearAccount(client)
      const repo = new SupabaseRepository(client, testDeps())
      const folder = await repo.createFolder({ name: 'IELTS' })
      // No user_id key at all: supabase-js would send an undefined one as null.
      const { user_id: _, ...handEdited } = { ...folderRow, id: testId(2), name: 'TOEIC  ' }
      await insert(client, 'folders', [{ ...handEdited, name_key: 'toeic' }])
      await expect(repo.listFolders()).rejects.toBeInstanceOf(InvalidStoredDataError)
      expect(await repo.getFolder(folder.id)).toEqual(folder)
    })

    it('signs in with SupabaseAuth and tells wrong credentials apart', async () => {
      const own = createClient(LOCAL_URL, LOCAL_PUBLISHABLE_KEY, { auth: NO_SESSION })
      const auth = new SupabaseAuth(own)
      await expect(auth.signIn({ ...TEST_USER, password: 'wrong' })).rejects.toThrow(
        new AuthenticationError('Wrong email or password.'),
      )
      const users: (string | null)[] = []
      const unsubscribe = auth.subscribe((userId) => users.push(userId))
      await auth.signIn(TEST_USER)
      await vi.waitFor(() => expect(users.at(-1)).toEqual(expect.any(String)))
      await auth.signOut()
      expect(users.at(-1)).toBeNull()
      unsubscribe()
    })

    it('reads app_config only when signed in', async () => {
      expect(await isClientOutdated(client)).toBe(false)
      const signedOut = createClient(LOCAL_URL, LOCAL_PUBLISHABLE_KEY, { auth: NO_SESSION })
      const onSessionExpired = vi.fn()
      await expect(isClientOutdated(signedOut, onSessionExpired)).rejects.toBeInstanceOf(
        SessionExpiredError,
      )
      expect(onSessionExpired).toHaveBeenCalledOnce()
    })

    it('reports SessionExpiredError when nobody is signed in', async () => {
      const signedOut = createClient(LOCAL_URL, LOCAL_PUBLISHABLE_KEY, { auth: NO_SESSION })
      const repo = new SupabaseRepository(signedOut, testDeps())
      await expect(repo.listFolders()).rejects.toBeInstanceOf(SessionExpiredError)
      await expect(repo.createFolder({ name: 'IELTS' })).rejects.toBeInstanceOf(SessionExpiredError)
    })
  })
})

/** Deleting folders cascades to files, terms and progress; study days hang off nothing. */
async function clearAccount(client: SupabaseClient) {
  for (const [table, column] of [
    ['folders', 'id'],
    ['study_days', 'date'],
  ] as const) {
    const { error } = await client.from(table).delete().not(column, 'is', null)
    if (error) throw new Error(`Could not clear ${table}: ${error.message}`)
  }
}

async function insert(client: SupabaseClient, table: string, rows: object[]) {
  const { error } = await client.from(table).insert(rows)
  if (error) throw new Error(`Could not insert into ${table}: ${error.message}`)
}
