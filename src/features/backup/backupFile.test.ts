import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Backup } from '../../domain/backup.ts'
import { backupFileName, downloadBackup } from './backupFile.ts'

describe('backupFileName', () => {
  it('uses the local date with zero padding', () => {
    expect(backupFileName(new Date(2026, 0, 5, 23, 59))).toBe('vocab-backup-2026-01-05.json')
  })
})

describe('downloadBackup', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('downloads the backup as JSON and frees the blob URL afterwards', async () => {
    vi.useFakeTimers()
    const blobs: Blob[] = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob as Blob)
      return 'blob:backup'
    })
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const backup = { schemaVersion: 1, exportedAt: '2026-10-22T08:00:00.000Z' } as Backup

    downloadBackup(backup, 'vocab-backup-2026-10-22.json')

    expect(click.mock.contexts[0]).toMatchObject({
      href: 'blob:backup',
      download: 'vocab-backup-2026-10-22.json',
    })
    expect(blobs[0]!.type).toBe('application/json')
    expect(JSON.parse(await blobs[0]!.text())).toEqual(backup)
    expect(revoke).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(revoke).toHaveBeenCalledWith('blob:backup')
  })
})
