/** Like `Math.random`: a number in [0, 1). Passed in so tests can fix the outcome. */
export type Random = () => number

/** An integer from `min` to `max`, both included. */
export function randomInt(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1))
}

/** A shuffled copy (Fisher-Yates); the input is left as is. */
export function shuffled<T>(items: readonly T[], random: Random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(random, 0, i)
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}
