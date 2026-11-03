/**
 * Canonical form of user-entered text before it is stored.
 * NFC matters for Vietnamese: macOS/iOS keyboards can produce NFD, which looks identical
 * but compares as a different string. Newlines collapse too: every input except file notes is
 * single-line (those use `normalizeMultilineText`).
 */
export function normalizeText(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/g, ' ')
}

/**
 * Canonical form of multi-line text (file notes): NFC, one kind of line break, trimmed ends.
 * Inner spacing and blank lines stay, since a pasted reading has paragraphs and indents.
 * Every break style becomes "\n" in ONE pass: replacing "\r" before "\r\n" would turn one
 * Windows break into two. Must be idempotent, because imported backups and cloud rows are
 * rejected when they differ from their normalized form (decision #35).
 */
export function normalizeMultilineText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/\r\n?|[\u2028\u2029]/g, '\n')
    .trim()
}

/**
 * The single comparison key for duplicate checks, lookups and answer grading.
 * - `toLowerCase`, not `toLocaleLowerCase`, so the key never depends on the device locale.
 * - Curly quotes become straight ones because iOS Smart Punctuation turns "don't" into "don’t".
 * - Diacritics are kept because "ma" and "má" are different words.
 *
 * Its output is stored (nameKey, wordKey), so changing it needs a DB version whose migration
 * recomputes every key. See docs/data-model.md#migration.
 */
export function toKey(text: string): string {
  return straightenQuotes(normalizeText(text).toLowerCase())
}

/** Curly quotes → straight ones, keeping the length (Learn maps match positions back). */
export function straightenQuotes(text: string): string {
  return text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
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
