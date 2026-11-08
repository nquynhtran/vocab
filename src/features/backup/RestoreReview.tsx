import type { BackupSummary } from '../../domain/restoreComparison.ts'
import { plural } from '../../shared/deleteMessages.ts'
import type { Review } from './RestoreBackup.tsx'

interface RestoreReviewProps {
  review: Review
  busy: boolean
  onDownload: () => void
  onRestore: () => void
  onCancel: () => void
}

/**
 * The confirmation step: current data next to the file, with what would be lost. It replaces a
 * `window.confirm` (docs/backup.md, step 3).
 */
export function RestoreReview({
  review,
  busy,
  onDownload,
  onRestore,
  onCancel,
}: RestoreReviewProps) {
  const { comparison, snapshotProblem } = review
  const { current, backup } = comparison

  if (comparison.currentIsEmpty) {
    // Nothing would be lost: no comparison, no warnings, no safety copy to offer.
    return (
      <div className="restore__review">
        <p>
          This file has {plural(backup.folders, 'folder')}, {plural(backup.files, 'file')} and{' '}
          {plural(backup.terms, 'term')}.
        </p>
        <div className="restore__actions">
          <button
            type="button"
            className="button button--primary"
            disabled={busy}
            onClick={onRestore}
          >
            Restore
          </button>
          <button type="button" className="button" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  const warnings = [
    comparison.currentIsNewer &&
      'Your current data is newer than this backup. Changes made since then will be lost.',
    comparison.removedStudyDays > 0 &&
      `${plural(comparison.removedStudyDays, 'study day')} not in the backup will be removed, ` +
        'so your streak may go down.',
    snapshotProblem &&
      `Your current data has a problem (${snapshotProblem}), so a copy taken now cannot be ` +
        'restored as is.',
    'Close the app on other devices first.',
  ].filter((warning) => typeof warning === 'string')

  return (
    <div className="restore__review">
      <table className="restore__table">
        <caption>Replace your current data with this backup?</caption>
        <thead>
          <tr>
            <td />
            <th scope="col">Current</th>
            <th scope="col">Backup</th>
          </tr>
        </thead>
        <tbody>
          <Row label="Folders" current={current} backup={backup} show={(s) => s.folders} />
          <Row label="Files" current={current} backup={backup} show={(s) => s.files} />
          <Row label="Terms" current={current} backup={backup} show={(s) => s.terms} />
          <Row
            label="Last edit"
            current={current}
            backup={backup}
            show={(s) => formatInstant(s.lastEdit)}
          />
          <Row
            label="Last study day"
            current={current}
            backup={backup}
            show={(s) => formatDay(s.lastStudyDay)}
          />
        </tbody>
      </table>
      <ul className="restore__warnings">
        {warnings.map((warning) => (
          <li key={warning} className="field-warning">
            {warning}
          </li>
        ))}
      </ul>
      <div className="restore__actions">
        <button type="button" className="button" disabled={busy} onClick={onDownload}>
          Download current data first
        </button>
        <button
          type="button"
          className="button button--danger-solid"
          disabled={busy}
          onClick={onRestore}
        >
          Replace all
        </button>
        <button type="button" className="button" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

interface RowProps {
  label: string
  current: BackupSummary
  backup: BackupSummary
  show: (summary: BackupSummary) => string | number
}

function Row({ label, current, backup, show }: RowProps) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{show(current)}</td>
      <td>{show(backup)}</td>
    </tr>
  )
}

const NONE = '—'

function formatInstant(timestamp: string | undefined): string {
  if (timestamp === undefined) return NONE
  return new Date(timestamp).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

/** A study day is a calendar day already (`YYYY-MM-DD`): no time zone to apply. */
function formatDay(day: string | undefined): string {
  if (day === undefined) return NONE
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year!, month! - 1, date).toLocaleDateString('en-GB', { dateStyle: 'medium' })
}
