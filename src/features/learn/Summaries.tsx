import { Link } from 'react-router'
import type { LearnSession } from '../../domain/learn/session.ts'
import { isSessionOver } from '../../domain/learn/session.ts'
import {
  mostMissed,
  roundTallies,
  sessionTotals,
  type TermTally,
} from '../../domain/learn/summary.ts'
import { plural } from '../../shared/deleteMessages.ts'

export function RoundSummary({
  session,
  onNextRound,
}: {
  session: LearnSession
  onNextRound: () => void
}) {
  return (
    <div className="summary">
      <h2>Round {session.round} done</h2>
      <TallyList label="This round" tallies={roundTallies(session)} />
      <button type="button" className="button button--primary" onClick={onNextRound} autoFocus>
        Next round
      </button>
    </div>
  )
}

/** Shown when every term is learned, and after Stop. */
export function SessionSummary({
  session,
  fileId,
  onStudyAgain,
}: {
  session: LearnSession
  fileId: string
  onStudyAgain: () => void
}) {
  const { correct, wrong } = sessionTotals(session)
  const missed = mostMissed(session)
  return (
    <div className="summary">
      <h2>
        {isSessionOver(session)
          ? `You learned all ${plural(session.terms.length, 'term')}!`
          : 'Session stopped'}
      </h2>
      <p>
        {plural(correct + wrong, 'answer')}: {correct} right, {wrong} wrong.
      </p>
      {missed.length > 0 && <TallyList label="Missed most" tallies={missed} />}
      <div className="summary__actions">
        <button type="button" className="button button--primary" onClick={onStudyAgain} autoFocus>
          Study again
        </button>
        <Link className="button" to={`/files/${fileId}`}>
          Back to list
        </Link>
      </div>
    </div>
  )
}

function TallyList({ label, tallies }: { label: string; tallies: TermTally[] }) {
  return (
    <>
      <h3>{label}</h3>
      <ul className="tally-list" aria-label={label}>
        {tallies.map(({ term, correct, wrong }) => (
          <li key={term.id} className="tally">
            <span className="tally__word">{term.word}</span>
            <span className="tally__meaning">{term.meaning}</span>
            <span className={wrong > 0 ? 'tally__count tally__count--wrong' : 'tally__count'}>
              {correct} right · {wrong} wrong
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}
