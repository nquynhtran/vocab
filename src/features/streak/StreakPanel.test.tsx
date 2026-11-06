import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ConnectionError, InvalidStoredDataError } from '../../domain/errors.ts'
import { summarizeStreak } from '../../domain/streak/streak.ts'
import type { StudyDay } from '../../domain/schemas.ts'
import { StreakPanel } from './StreakPanel.tsx'
import type { StreakState } from './useStreak.ts'

const TODAY = '2026-11-05'

function ready(days: readonly StudyDay[], refreshError?: unknown): StreakState {
  return {
    status: 'ready',
    data: { summary: summarizeStreak(days, TODAY), today: TODAY },
    refreshError,
  }
}

const studied = (...dates: string[]) => dates.map((date) => ({ date, answeredCount: 10 }))

/** The cell showing `date` in the shown month; the grid has at most one per number. */
function dayCell(date: number) {
  const cell = within(screen.getByRole('table'))
    .getAllByRole('cell')
    .find((c) => c.textContent?.replace(', studied', '') === String(date))
  if (!cell) throw new Error(`no cell for ${date}`)
  return cell
}

describe('StreakPanel', () => {
  describe('streak line', () => {
    it('invites to start when nothing was studied, with no record to show', () => {
      render(<StreakPanel state={ready([])} />)
      expect(screen.getByText('Start a streak today')).toBeInTheDocument()
    })

    it('keeps the record next to the invitation once a streak was lost', () => {
      render(<StreakPanel state={ready(studied('2026-10-01', '2026-10-02'))} />)
      expect(screen.getByText('Start a streak today · Best 2')).toBeInTheDocument()
    })

    it('shows the current streak and the record', () => {
      const days = studied('2026-10-01', '2026-10-02', '2026-10-03', '2026-11-04', TODAY)
      render(<StreakPanel state={ready(days)} />)
      expect(screen.getByText('🔥 2-day streak · Best 3')).toBeInTheDocument()
    })
  })

  describe('today line', () => {
    it('counts towards the minimum', () => {
      render(<StreakPanel state={ready([{ date: TODAY, answeredCount: 4 }])} />)
      expect(screen.getByText('Today: 4/10 answers')).toBeInTheDocument()
    })

    it('still shows the fraction one answer below', () => {
      render(<StreakPanel state={ready([{ date: TODAY, answeredCount: 9 }])} />)
      expect(screen.getByText('Today: 9/10 answers')).toBeInTheDocument()
    })

    it('shows the count and a check from the minimum on', () => {
      render(<StreakPanel state={ready([{ date: TODAY, answeredCount: 10 }])} />)
      expect(screen.getByText('Today: 10 answers ✓')).toBeInTheDocument()
    })

    it("uses today's count, not the latest day's", () => {
      const days = [
        { date: '2026-11-04', answeredCount: 25 },
        { date: TODAY, answeredCount: 3 },
      ]
      render(<StreakPanel state={ready(days)} />)
      expect(screen.getByText('Today: 3/10 answers')).toBeInTheDocument()
    })
  })

  describe('problems', () => {
    it('reports a failed first load without an alert', () => {
      render(<StreakPanel state={{ status: 'error', error: new Error('down') }} />)
      expect(screen.getByText('Streak could not be loaded.')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    const badData = new InvalidStoredDataError('study_days 3: date', 'invalid date')

    it('says where stored data is bad when the first load fails', () => {
      render(<StreakPanel state={{ status: 'error', error: badData }} />)
      expect(screen.getByText(/Streak could not be loaded\. Data in the cloud/)).toHaveTextContent(
        'study_days 3: date',
      )
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('says where stored data is bad when a reload fails', () => {
      render(<StreakPanel state={ready([], badData)} />)
      expect(screen.getByText(/Streak may be out of date\. Data in the cloud/)).toHaveTextContent(
        'study_days 3: date',
      )
    })

    it('adds no detail for a connection problem, which the page reports already', () => {
      render(<StreakPanel state={{ status: 'error', error: new ConnectionError() }} />)
      expect(screen.getByText('Streak could not be loaded.')).toBeInTheDocument()
    })

    it('keeps the numbers when a reload failed, without an alert', () => {
      render(<StreakPanel state={ready(studied(TODAY), new Error('down'))} />)
      expect(screen.getByText('🔥 1-day streak · Best 1')).toBeInTheDocument()
      expect(screen.getByText('Streak may be out of date.')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('calendar', () => {
    it('is collapsed at first', () => {
      render(<StreakPanel state={ready([])} />)
      expect(screen.getByText('Calendar').closest('details')).not.toHaveAttribute('open')
    })

    it('starts the week on Monday', () => {
      render(<StreakPanel state={ready([])} />)
      const headers = within(screen.getByRole('table', { hidden: true }))
        .getAllByRole('columnheader', { hidden: true })
        .map((header) => header.textContent)
      expect(headers).toStrictEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    })

    function openCalendar() {
      screen.getByText('Calendar').closest('details')?.setAttribute('open', '')
    }

    it('marks days with enough answers, in words too, and no others', () => {
      const days = [
        { date: '2026-11-03', answeredCount: 9 },
        { date: '2026-11-04', answeredCount: 10 },
      ]
      render(<StreakPanel state={ready(days)} />)
      openCalendar()

      expect(dayCell(4)).toHaveClass('calendar__day--studied')
      expect(dayCell(4)).toHaveTextContent('4, studied')
      expect(dayCell(3)).not.toHaveClass('calendar__day--studied')
      expect(dayCell(3)).toHaveTextContent(/^3$/)
    })

    it('marks today as the current date', () => {
      render(<StreakPanel state={ready([])} />)
      openCalendar()
      expect(dayCell(5)).toHaveAttribute('aria-current', 'date')
      expect(dayCell(4)).not.toHaveAttribute('aria-current')
    })

    it('goes back to earlier months and shows their study days', () => {
      render(<StreakPanel state={ready(studied('2026-10-31'))} />)
      openCalendar()
      expect(dayCell(30)).not.toHaveClass('calendar__day--studied')

      fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))

      expect(screen.getByRole('table', { name: 'October 2026' })).toBeInTheDocument()
      expect(dayCell(31)).toHaveClass('calendar__day--studied')
    })

    it('goes back across a year', () => {
      render(<StreakPanel state={ready([])} />)
      openCalendar()
      for (let i = 0; i < 11; i += 1) {
        fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
      }
      expect(screen.getByRole('table', { name: 'December 2025' })).toBeInTheDocument()
    })

    it('does not go past the current month', () => {
      render(<StreakPanel state={ready([])} />)
      openCalendar()
      const next = screen.getByRole('button', { name: 'Next month' })
      expect(next).toHaveAttribute('aria-disabled', 'true')

      fireEvent.click(next)
      expect(screen.getByRole('table', { name: 'November 2026' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
      expect(next).toHaveAttribute('aria-disabled', 'false')
      fireEvent.click(next)
      expect(screen.getByRole('table', { name: 'November 2026' })).toBeInTheDocument()
    })
  })
})
