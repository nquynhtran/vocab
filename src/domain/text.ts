/**
 * Canonical form of user-entered text before it is stored.
 * NFC matters for Vietnamese: macOS/iOS keyboards can produce NFD, which looks identical
 * but compares as a different string. Newlines collapse too: every input is single-line.
 */
export function normalizeText(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/g, ' ')
}

/**
 * The single comparison key for duplicate checks, lookups and answer grading.
 * - `toLowerCase`, not `toLocaleLowerCase`, so the key never depends on the device locale.
 * - Curly quotes become straight ones because iOS Smart Punctuation turns "don't" into "don’t".
 * - Diacritics are kept because "ma" and "má" are different words.
 */
export function toKey(text: string): string {
  return normalizeText(text).toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
}

/**
 * Display order for folder and file names, shared by every repository so the order never
 * depends on a database collation. The locale is fixed to Vietnamese (which also orders English
 * correctly) so every device shows the same order, e.g. "đ" right after "d".
 * `numeric` puts "Unit 2" before "Unit 10".
 */
export function compareNames(a: string, b: string): number {
  return a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' })
}
