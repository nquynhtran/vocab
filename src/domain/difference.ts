/**
 * Path of the first place where the parsed value differs from the input, or undefined when they
 * match. Absent and `undefined` fields count as equal, since JSON cannot tell them apart.
 *
 * Used after a Zod parse of stored or imported data: the schemas normalize while parsing, so a
 * difference means the data was not what this app writes and must be rejected (decision #35).
 * The root path is ''.
 */
export function firstDifference(input: unknown, parsed: unknown, path = ''): string | undefined {
  if (Array.isArray(input) || Array.isArray(parsed)) {
    if (!Array.isArray(input) || !Array.isArray(parsed) || input.length !== parsed.length) {
      return path
    }
    for (const [index, item] of input.entries()) {
      const found = firstDifference(item, parsed[index], join(path, String(index)))
      if (found !== undefined) return found
    }
    return undefined
  }
  if (isRecord(input) || isRecord(parsed)) {
    if (!isRecord(input) || !isRecord(parsed)) return path
    for (const key of new Set([...Object.keys(input), ...Object.keys(parsed)])) {
      const found = firstDifference(input[key], parsed[key], join(path, key))
      if (found !== undefined) return found
    }
    return undefined
  }
  return Object.is(input, parsed) ? undefined : path
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function join(path: string, key: string): string {
  return path ? `${path}.${key}` : key
}
