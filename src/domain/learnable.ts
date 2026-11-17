import type { Term } from './schemas.ts'

/**
 * The one rule for "is this term learned" (#90). Learn, mastery counts and progress writes all
 * ask this; the SQL functions repeat it as `kind = 'word'` and contract tests keep them equal.
 */
export function isLearnable(term: Pick<Term, 'kind'>): boolean {
  return term.kind === 'word'
}
