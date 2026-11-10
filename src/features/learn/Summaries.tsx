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
import { canSpeak, speak } from '../../shared/speech.ts'

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

/**
 * Shown when every term is learned, and after Stop (#64). Both reload the page: a learned file
 * then starts a new session, a stopped one goes on unless its saved copy was cleared first.
 */
export function SessionSummary({
  session,
  fileId,
  onReload,
  onStartOver,
}: {
  session: LearnSession
  fileId: string
  onReload: () => void
  onStartOver: () => void
}) {
  const { correct, wrong } = sessionTotals(session)
  const missed = mostMissed(session)
  const learnedAll = isSessionOver(session)
  return (
    <div className="summary">
      <h2>
        {learnedAll
          ? `You learned all ${plural(session.terms.length, 'term')}!`
          : 'Session stopped'}
      </h2>
      <p>
        {plural(correct + wrong, 'answer')}: {correct} right, {wrong} wrong.
      </p>
      {missed.length > 0 && <TallyList label="Missed most" tallies={missed} />}
      {/* "learned" above is this session only; without this, it reads like the folder's "% mastered". */}
      <p className="muted">Terms count as mastered once you get them right on 2 different days.</p>
      <div className="summary__actions">
        <button type="button" className="button button--primary" onClick={onReload} autoFocus>
          {learnedAll ? 'Study again' : 'Continue'}
        </button>
        {!learnedAll && (
          <button type="button" className="button" onClick={onStartOver}>
            Start over
          </button>
        )}
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
            <span className="tally__term">
              <TallyWord word={term.word} />
              {term.pronunciation && <span className="pronunciation">{term.pronunciation}</span>}
            </span>
            <span className="tally__meaning">{term.meaning}</span>
            <span className={wrong > 0 ? 'tally__count tally__count--wrong' : 'tally__count'}>
              {correct} right · {wrong} wrong
            </span>
            {/* Unmasked: the question is answered, so nothing is left to give away (#83). */}
            {term.example && <span className="tally__example">{term.example}</span>}
          </li>
        ))}
      </ul>
    </>
  )
}

/** The whole word is the button, so a phone user taps the word itself to hear it. */
function TallyWord({ word }: { word: string }) {
  if (!canSpeak()) return <span className="tally__word">{word}</span>
  return (
    <button
      type="button"
      className="tally__word tally__listen"
      aria-label={`Listen to "${word}"`}
      onClick={() => speak(word)}
    >
      {word}
      <span className="tally__speaker" aria-hidden="true">
        🔊
      </span>
    </button>
  )
}
