import { PronunciationSchema } from './schemas.ts'
import { normalizeText, straightenQuotes } from './text.ts'

/**
 * Picking a British pronunciation out of Wiktionary data, as pure functions.
 * The network part is in data/wiktionary.ts. Rules: docs/pronunciation-lookup.md.
 */

/** One entry of the MediaWiki `prop=sections` list, already checked by the caller. */
export interface WikiSection {
  level: number
  line: string
  index: string
}

/**
 * Page titles to try for a typed word, in order. Wiktionary titles are case-sensitive ("Polish"
 * and "polish" are different pages), so a capitalized word is retried in lower case.
 * Curly quotes are straightened because iOS types "don’t" while the page is "don't".
 * Characters MediaWiki does not allow in titles give no titles at all: "C#" would otherwise be
 * read as the page "C" plus an anchor and return a wrong pronunciation.
 */
export function wiktionaryTitles(word: string): string[] {
  const title = straightenQuotes(normalizeText(word))
  if (title === '' || /[#<>[\]{}|]/.test(title)) return []
  const lower = title.toLowerCase()
  return lower === title ? [title] : [title, lower]
}

/** The index of the first Pronunciation section inside the English section, if any. */
export function findPronunciationSection(sections: readonly WikiSection[]): string | undefined {
  let inEnglish = false
  for (const section of sections) {
    if (section.level === 2) inEnglish = section.line === 'English'
    else if (inEnglish && section.line.startsWith('Pronunciation')) return section.index
  }
  return undefined
}

const BRITISH_LABELS = new Set([
  'rp',
  'uk',
  'ssb',
  'british',
  'received pronunciation',
  'standard southern british',
])

/** One transcription with every accent label that applies to it. */
interface Candidate {
  value: string
  labels: string[]
}

/**
 * The pronunciation to suggest from a Pronunciation section's wikitext, in the Cambridge style
 * learners know, or `undefined` when nothing usable is there. In order: the first British
 * phonemic `/…/`, British phonetic `[…]`, any `/…/`, any `[…]`. A label applies through the
 * template (`a=`), the value itself (`<a:RP>`), or an `{{a}}` on the line or a line above.
 */
export function pickPronunciation(wikitext: string): string | undefined {
  const usable = ipaCandidates(wikitext)
    .map((candidate) => ({ ...candidate, value: toCambridgeStyle(candidate.value) }))
    .filter(({ value }) => isStorable(value))
  const british = usable.filter((candidate) => candidate.labels.some(isBritish))
  const first = (list: readonly Candidate[], pattern: RegExp) =>
    list.find(({ value }) => pattern.test(value))?.value
  return (
    first(british, PHONEMIC) ??
    first(british, PHONETIC) ??
    first(usable, PHONEMIC) ??
    first(usable, PHONETIC)
  )
}

function isBritish(label: string): boolean {
  return BRITISH_LABELS.has(label.trim().toLowerCase())
}

function ipaCandidates(wikitext: string): Candidate[] {
  // Comments and references can hold anything, including templates and line breaks.
  const text = wikitext
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref\b[^>]*\/>/g, '')
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/g, '')

  const candidates: Candidate[] = []
  // Accent labels set by `{{a|…}}` lines, by list depth: they apply to the deeper lines below.
  const labelsByDepth = new Map<number, string[]>()
  for (const line of text.split('\n')) {
    const depth = /^\*+/.exec(line)?.[0].length ?? 0
    for (const d of [...labelsByDepth.keys()]) if (d >= depth) labelsByDepth.delete(d)
    const inherited = [...labelsByDepth.values()].flat()

    const lineLabels = templates(line, /\{\{(?:a|accent)\|([^{}]*)\}\}/g).flatMap((params) =>
      unnamed(params).filter((param) => param !== 'en'),
    )
    if (lineLabels.length > 0) labelsByDepth.set(depth, lineLabels)

    for (const params of templates(line, /\{\{IPA\|en\|([^{}]*)\}\}/g)) {
      const labels = [...inherited, ...lineLabels, ...named(params, 'a')]
      for (const value of unnamed(params)) {
        candidates.push({
          value: value.replace(/<[^<>]*>/g, '').trim(),
          labels: [...labels, ...modifiers(value, 'a')],
        })
      }
    }
  }
  return candidates
}

/** The parameter lists of every template the pattern matches on a line, split at `|`. */
function templates(line: string, pattern: RegExp): string[][] {
  return [...line.matchAll(pattern)].map((match) => (match[1] ?? '').split('|'))
}

const NAMED_PARAM = /^\s*[\w-]+\s*=/

function unnamed(params: readonly string[]): string[] {
  return params.filter((param) => !NAMED_PARAM.test(param)).map((param) => param.trim())
}

/** The comma-separated values of a named parameter such as `a=GA,RP`. */
function named(params: readonly string[], name: string): string[] {
  return params
    .filter((param) => param.trim().startsWith(`${name}=`))
    .flatMap((param) =>
      param
        .trim()
        .slice(name.length + 1)
        .split(','),
    )
    .map((label) => label.trim())
}

/** The comma-separated values of inline modifiers such as `/ɹʌn/<a:RP>`. */
function modifiers(value: string, name: string): string[] {
  return [...value.matchAll(new RegExp(`<${name}:([^<>]*)>`, 'g'))]
    .flatMap((match) => (match[1] ?? '').split(','))
    .map((label) => label.trim())
}

const PHONEMIC = /^\/[^/<>{}|[\]]+\/$/
const PHONETIC = /^\[[^[\]<>{}|/]+\]$/

/** The patterns keep markup out; the schema adds the length limit and unstorable characters. */
function isStorable(value: string): boolean {
  const parsed = PronunciationSchema.safeParse(value)
  return parsed.success && parsed.data === value
}

/**
 * Wiktionary's symbols → the ones Cambridge and Oxford use (decision #66): /ɹʌn/ → /rʌn/,
 * /ˈʃɛd͡ʒuːl/ → /ˈʃedʒuːl/. Syllable dots stay; Cambridge shows them too.
 */
export function toCambridgeStyle(ipa: string): string {
  return ipa.replace(/ɹ/g, 'r').replace(/ɛ/g, 'e').replace(/[͜͡]/g, '')
}
