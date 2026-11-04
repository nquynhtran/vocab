import { describe, expect, it } from 'vitest'
import {
  findPronunciationSection,
  pickPronunciation,
  toCambridgeStyle,
  wiktionaryTitles,
  type WikiSection,
} from './pronunciation.ts'
import * as real from './pronunciation.fixtures.ts'

describe('pickPronunciation on real Wiktionary sections', () => {
  it.each([
    // Labelled `a=GA,RP`: one transcription for both accents.
    ['run', real.run, '/rʌn/'],
    // RP set by an accent line above, with a <ref> holding templates on that line.
    ['schedule', real.schedule, '/ˈʃedʒuːl/'],
    // `a=RP,AU` comes first; the US and narrow [ ] forms are skipped.
    ['tomato', real.tomato, '/təˈmɑː.təʊ/'],
    // Syllable dots stay (Cambridge shows them too).
    ['environment', real.environment, '/ɪnˈvaɪ.rə.mənt/'],
    // RP inside a nested accent group; "19th century <<RP>>" is not a match.
    ['more', real.more, '/mɔː/'],
    ['surname', real.surname, '/ˈsɜːˌneɪm/'],
    // `a=UK`.
    ['Polish', real.polishCapital, '/ˈpəʊlɪʃ/'],
  ])('%s', (_, wikitext, expected) => {
    expect(pickPronunciation(wikitext)).toBe(expected)
  })

  it('finds nothing in a section with only audio, as for most phrases ("give up")', () => {
    expect(pickPronunciation(real.giveUp)).toBeUndefined()
  })
})

describe('pickPronunciation on unusual markup', () => {
  it('strips inline modifiers and reads the accent from <a:…>', () => {
    const wikitext = [
      '* {{IPA|en|/ˈsɝ.neɪm/<a:GA>|/ˈsɜː.neɪm/<a:RP><q:formal>}}',
      '* {{IPA|en|/ˈsʌɹ.neɪm/<qq:rare>}}',
    ].join('\n')
    expect(pickPronunciation(wikitext)).toBe('/ˈsɜː.neɪm/')
    expect(pickPronunciation('* {{IPA|en|/ˈsɜː.neɪm/<q:formal>}}')).toBe('/ˈsɜː.neɪm/')
  })

  it('uses the accent of an {{a}} on the same line', () => {
    const wikitext = '* {{a|en|US}} {{IPA|en|/tʃæns/}}\n* {{a|en|UK}} {{IPA|en|/tʃɑːns/}}'
    expect(pickPronunciation(wikitext)).toBe('/tʃɑːns/')
  })

  it('labels only the IPA after an {{a}} on the same line, up to the next {{a}}', () => {
    expect(pickPronunciation('* {{IPA|en|/tʃæns/|a=GA}}; {{a|en|UK}} {{IPA|en|/tʃɑːns/}}')).toBe(
      '/tʃɑːns/',
    )
    expect(
      pickPronunciation('* {{a|en|US}} {{IPA|en|/tʃæns/}}, {{a|en|UK}} {{IPA|en|/tʃɑːns/}}'),
    ).toBe('/tʃɑːns/')
  })

  it('passes the last {{a}} of a line down to the lines below it', () => {
    const wikitext = '* {{a|en|US}} {{IPA|en|/x/}}, {{a|en|UK}}\n** {{IPA|en|/ɡɑːˈrɑːʒ/}}'
    expect(pickPronunciation(`* {{IPA|en|/ɡəˈrɑːʒ/}}\n${wikitext}`)).toBe('/ɡɑːˈrɑːʒ/')
  })

  it('does not let an accent line apply to its siblings', () => {
    // Inherited, the GA line would count as British and come first.
    const wikitext = '* {{a|en|RP}}\n* {{IPA|en|/ɡəˈrɑːʒ/|a=GA}}\n* {{IPA|en|/ˈɡærɑːʒ/|a=UK}}'
    expect(pickPronunciation(wikitext)).toBe('/ˈɡærɑːʒ/')
  })

  it('ignores comments and references, even across lines', () => {
    const wikitext = [
      '<!-- {{IPA|en|/wɹɒŋ/|a=RP}} -->',
      '* {{IPA|en|/ɹaɪt/|a=RP}}<ref>{{cite-web|title=a\nb}}</ref>',
      '<ref name="x"/>',
    ].join('\n')
    expect(pickPronunciation(wikitext)).toBe('/raɪt/')
  })

  it('takes the first template when none is labelled British', () => {
    expect(pickPronunciation('* {{IPA|en|/kæt/}}\n* {{IPA|en|/kat/|a=Scotland}}')).toBe('/kæt/')
  })

  it('prefers British, then /…/ over […]', () => {
    expect(pickPronunciation('* {{IPA|en|[kʰæt]|/kæt/|a=RP}}')).toBe('/kæt/')
    expect(pickPronunciation('* {{IPA|en|/kæt/|a=GA}}\n* {{IPA|en|[kʰæt]|a=RP}}')).toBe('[kʰæt]')
    expect(pickPronunciation('* {{IPA|en|[kʰæt]}}\n* {{IPA|en|/kat/|a=Scotland}}')).toBe('/kat/')
  })

  it.each([
    ['a broken template', '* {{IPA|en|/kæt/'],
    ['a template of another language', '* {{IPA|fr|/ʃa/}}'],
    ['a value that is not /…/ or […]', '* {{IPA|en|kæt|a=RP}}'],
    ['a value with leftover markup', '* {{IPA|en|/kæt/ [[x]]|a=RP}}'],
    ['wiki bold inside a value', "* {{IPA|en|/k'''æ'''t/|a=RP}}"],
    ['an HTML entity inside a value', '* {{IPA|en|/kæt&nbsp;/|a=RP}}'],
    ['an unclosed comment before the IPA', '<!-- note\n* {{IPA|en|/kæt/}}'],
    ['a nested template inside IPA', '* {{IPA|en|/kæt/{{q|x}}|a=RP}}'],
    ['a value over the length limit', `* {{IPA|en|/${'ə'.repeat(100)}/}}`],
    ['a character the cloud cannot store', '* {{IPA|en|/kæ\u0000t/}}'],
    ['nothing', ''],
  ])('finds nothing in %s', (_, wikitext) => {
    expect(pickPronunciation(wikitext)).toBeUndefined()
  })

  it('strips refs but leaves other tags starting the same way', () => {
    // Taken for a ref, this one would swallow the rest of the text as an unclosed tag.
    expect(pickPronunciation('* <references>{{IPA|en|/kæt/}}')).toBe('/kæt/')
    expect(pickPronunciation('* <ref name="a">{{IPA|en|/wɒŋ/}}</ref>{{IPA|en|/kæt/}}')).toBe(
      '/kæt/',
    )
    expect(pickPronunciation('* <ref name="a"/>{{IPA|en|/kæt/}}')).toBe('/kæt/')
    expect(pickPronunciation('* {{IPA|en|/kæt/}}<ref>{{IPA|en|/wɒŋ/|a=RP}}')).toBe('/kæt/')
    expect(pickPronunciation('* <ref {{IPA|en|/kæt/}}')).toBe('/kæt/')
  })

  // A vandalized page must not freeze the tab: the parsing is synchronous, so the lookup's
  // timeout cannot interrupt it. 200 KB is the most the lookup accepts. Compares two sizes on
  // this machine instead of a fixed time, so a slow or busy machine does not fail it: 8× the
  // text may take about 8× as long, while quadratic code takes about 64×.
  const repeated =
    (chunk: string, start = '* ') =>
    (length: number) =>
      `${start}${chunk.repeat(Math.ceil(length / chunk.length))}`.slice(0, length - 2) + '}}'
  it.each<[string, (length: number) => string]>([
    ['unclosed comments', repeated('<!--')],
    ['tag openings without an end', repeated('<ref ')],
    ['unclosed refs', repeated('<ref>')],
    ['self-closed refs', repeated('<ref/>')],
    ['lookalike tags', repeated('<reference')],
    ['lookalike tags that close', repeated('<references>')],
    ['unclosed templates', repeated('{{IPA|en|')],
    ['accent templates', repeated('{{a|en|RP}}')],
    ['unusable values in one template', repeated('x|', '* {{IPA|en|')],
    [
      'many values with many labels',
      (length) => {
        const n = Math.floor(length / 4)
        return `{{IPA|en|${'x|'.repeat(n)}a=${'R,'.repeat(n)}}}`
      },
    ],
    [
      'many labels inherited by many lines',
      (length) => {
        const n = Math.floor(length / 5)
        return `* {{a|en|${'x|'.repeat(n)}}}\n${'**\n'.repeat(n)}`
      },
    ],
  ])('takes linear time on %s', (_, textOf) => {
    const bestTime = (text: string) =>
      Math.min(
        ...[1, 2, 3].map(() => {
          const before = performance.now()
          pickPronunciation(text)
          return performance.now() - before
        }),
      )
    const small = bestTime(textOf(25_000))
    const large = bestTime(textOf(200_000))
    // The 50 ms floor: at a few ms, a pause of the runtime would decide the ratio.
    expect(large).toBeLessThan(Math.max(small * 24, 50))
  })

  it('skips an unusable value and uses the next template', () => {
    expect(pickPronunciation('* {{IPA|en|kæt|a=RP}}\n* {{IPA|en|/kæt/}}')).toBe('/kæt/')
  })
})

describe('toCambridgeStyle', () => {
  it('writes r for ɹ, e for ɛ and drops tie bars', () => {
    expect(toCambridgeStyle('/ˈʃɛd͡ʒuːl/')).toBe('/ˈʃedʒuːl/')
    expect(toCambridgeStyle('/ɹɛd t͜ʃ/')).toBe('/red tʃ/')
  })
})

describe('findPronunciationSection', () => {
  const section = (level: number, line: string, index: string): WikiSection => ({
    level,
    line,
    index,
  })

  it('finds the first Pronunciation inside English, not in another language', () => {
    const sections = [
      section(2, 'Translingual', '1'),
      section(3, 'Pronunciation', '2'),
      section(2, 'English', '3'),
      section(3, 'Etymology 1', '4'),
      section(4, 'Pronunciation 1', '5'),
      section(4, 'Pronunciation', '6'),
      section(2, 'French', '7'),
    ]
    expect(findPronunciationSection(sections)).toBe('5')
  })

  it('finds nothing when English has no Pronunciation', () => {
    const sections = [
      section(2, 'English', '1'),
      section(3, 'Verb', '2'),
      section(2, 'French', '3'),
      section(3, 'Pronunciation', '4'),
    ]
    expect(findPronunciationSection(sections)).toBeUndefined()
  })
})

describe('wiktionaryTitles', () => {
  it('normalizes and straightens quotes', () => {
    expect(wiktionaryTitles('  don’t  ')).toEqual(["don't"])
    expect(wiktionaryTitles('give  up')).toEqual(['give up'])
  })

  it('retries a capitalized word in lower case', () => {
    expect(wiktionaryTitles('Polish')).toEqual(['Polish', 'polish'])
  })

  it.each(['C#', 'a|b', 'x[1]', '{{a}}', '<b>', '   '])('gives no title for %j', (word) => {
    expect(wiktionaryTitles(word)).toEqual([])
  })
})
