import { useState } from 'react'
import { addMonths, monthOfDay, monthTitle, monthWeeks } from '../../domain/streak/calendar.ts'
import { Icon } from '../../shared/Icon.tsx'

const WEEKDAYS = [
  ['Mon', 'Monday'],
  ['Tue', 'Tuesday'],
  ['Wed', 'Wednesday'],
  ['Thu', 'Thursday'],
  ['Fri', 'Friday'],
  ['Sat', 'Saturday'],
  ['Sun', 'Sunday'],
] as const

interface StreakCalendarProps {
  studiedDays: ReadonlySet<string>
  today: string
}

/** Collapsed by default so that on a phone the folder list stays near the top (decision #71). */
export function StreakCalendar({ studiedDays, today }: StreakCalendarProps) {
  // Counted back from today's month, so the view cannot pass it and follows it into a new month.
  const [monthsBack, setMonthsBack] = useState(0)
  const month = addMonths(monthOfDay(today), -monthsBack)
  const title = monthTitle(month)
  const atCurrentMonth = monthsBack === 0

  return (
    <details className="streak__calendar">
      <summary>Calendar</summary>
      <div className="calendar__header">
        <button
          type="button"
          className="button icon-button"
          aria-label="Previous month"
          onClick={() => setMonthsBack((back) => back + 1)}
        >
          <Icon name="chevronLeft" />
        </button>
        <span className="calendar__title" aria-live="polite">
          {title}
        </span>
        {/* aria-disabled, not disabled: a disabled button would drop the keyboard focus on it. */}
        <button
          type="button"
          className="button icon-button"
          aria-label="Next month"
          aria-disabled={atCurrentMonth}
          onClick={() => setMonthsBack((back) => Math.max(back - 1, 0))}
        >
          <Icon name="chevronRight" />
        </button>
      </div>
      <table className="calendar" aria-label={title}>
        <thead>
          <tr>
            {WEEKDAYS.map(([short, full]) => (
              <th key={short} scope="col" abbr={full}>
                {short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthWeeks(month).map((week, row) => (
            <tr key={row}>
              {week.map((day, column) =>
                day === null ? (
                  <td key={column} />
                ) : (
                  <CalendarDay
                    key={day}
                    day={day}
                    studied={studiedDays.has(day)}
                    isToday={day === today}
                  />
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

function CalendarDay({
  day,
  studied,
  isToday,
}: {
  day: string
  studied: boolean
  isToday: boolean
}) {
  const className = [studied && 'calendar__day--studied', isToday && 'calendar__day--today']
    .filter(Boolean)
    .join(' ')
  return (
    <td className={className || undefined} aria-current={isToday ? 'date' : undefined}>
      {Number(day.slice(8))}
      {studied && <span className="visually-hidden">, studied</span>}
    </td>
  )
}
