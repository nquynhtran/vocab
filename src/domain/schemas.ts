import { z } from 'zod'
import { normalizeMultilineText, normalizeText } from './text.ts'

export const NAME_MAX_LENGTH = 200
export const EXAMPLE_MAX_LENGTH = 500
export const PRONUNCIATION_MAX_LENGTH = 100
/** Repeated in the CHECK on files.notes in supabase/migrations. */
export const NOTES_MAX_LENGTH = 10_000
export const BOX_MIN = 1
export const BOX_MAX = 5

/**
 * Text Postgres cannot store: U+0000 (error 22P05) and lone UTF-16 surrogates (invalid JSON on
 * the way to the cloud). Rejected here so local and cloud accept exactly the same input.
 * With the `u` flag, \p{Cs} matches only unpaired surrogates; emoji pairs are fine.
 */
const UNSTORABLE_TEXT = /[\0\p{Cs}]/u

function storableText(label: string, max: number) {
  return z
    .string()
    .max(max, { error: `${label} must be at most ${max} characters` })
    .refine((text) => !UNSTORABLE_TEXT.test(text), {
      error: `${label} contains a character that cannot be saved`,
    })
}

/** Normalizes first so the length limits apply to what is actually stored. */
function requiredText(label: string, max: number) {
  return z
    .string()
    .transform(normalizeText)
    .pipe(storableText(label, max).min(1, { error: `${label} is required` }))
}

/** Blank text is stored as "not set", so the field is simply absent. */
function optionalText(label: string, max: number, normalize: (text: string) => string) {
  return z
    .string()
    .optional()
    .transform((value) => (value === undefined ? undefined : normalize(value) || undefined))
    .pipe(storableText(label, max).optional())
}

const ExampleSchema = optionalText('Example', EXAMPLE_MAX_LENGTH, normalizeText)

/** Stored exactly as typed, slashes included or not (docs/data-model.md). */
export const PronunciationSchema = optionalText(
  'Pronunciation',
  PRONUNCIATION_MAX_LENGTH,
  normalizeText,
)

/** Multi-line: keeps line breaks and blank lines (docs/data-model.md). */
const NotesSchema = optionalText('Notes', NOTES_MAX_LENGTH, normalizeMultilineText)

/**
 * Stored as these full names; abbreviations ("v.") are display only (features/terms).
 * Removing or renaming a value needs a migration of stored terms and backups. Any change also
 * needs a SQL migration of the `parts_of_speech` CHECK in supabase/migrations (docs/cloud-sync.md).
 */
export const PARTS_OF_SPEECH = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'phrasal verb',
  'phrase',
  'preposition',
  'conjunction',
  'pronoun',
  'other',
] as const
export type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number]

/**
 * What a term is for. `collocation` (a phrase or collocation, #90) stays in the file's list but is
 * never learned; only `word` takes part in Learn and mastery. Stored on every term.
 */
export const TERM_KINDS = ['word', 'collocation'] as const
export type TermKind = (typeof TERM_KINDS)[number]

/**
 * A term can have several parts of speech ("present" is an adjective and a noun). Stored as a
 * list in the order of PARTS_OF_SPEECH, so equal sets are equal arrays. The empty list means
 * "not set". A value repeated in the input is rejected rather than silently merged.
 */
const PartsOfSpeechSchema = z
  .array(z.string())
  // Checked here rather than with z.enum on the items: a bad item then reports under the field
  // itself ("partsOfSpeech"), not under its index, which is where the form shows errors.
  .superRefine((values, ctx) => {
    if (!values.every((value) => (PARTS_OF_SPEECH as readonly string[]).includes(value))) {
      ctx.addIssue({ code: 'custom', message: 'Choose parts of speech from the list' })
    }
    if (new Set(values).size !== values.length) {
      ctx.addIssue({ code: 'custom', message: 'Each part of speech can be chosen once' })
    }
  })
  .transform((values) => PARTS_OF_SPEECH.filter((part) => values.includes(part)))

export const IdSchema = z.uuid()
export const TimestampSchema = z.iso.datetime()
const CountSchema = z.int().min(0)

export const FolderInputSchema = z.object({ name: requiredText('Name', NAME_MAX_LENGTH) })
export const FileInputSchema = z.object({ name: requiredText('Name', NAME_MAX_LENGTH) })
/** Separate from the name, so renaming and editing notes never overwrite each other (#65). */
export const FileNotesInputSchema = z.object({ notes: NotesSchema })
export const TermInputSchema = z.object({
  word: requiredText('Term', NAME_MAX_LENGTH),
  kind: z.enum(TERM_KINDS, { error: 'Choose word or collocation' }).default('word'),
  partsOfSpeech: PartsOfSpeechSchema.default([]),
  pronunciation: PronunciationSchema,
  meaning: requiredText('Meaning', NAME_MAX_LENGTH),
  example: ExampleSchema,
})

export const FolderSchema = z.object({
  id: IdSchema,
  ...FolderInputSchema.shape,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
})

export const VocabFileSchema = z.object({
  id: IdSchema,
  folderId: IdSchema,
  ...FileInputSchema.shape,
  ...FileNotesInputSchema.shape,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
})

export const TermSchema = z.object({
  id: IdSchema,
  fileId: IdSchema,
  ...TermInputSchema.shape,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
})

/** A local calendar day, `YYYY-MM-DD` (docs/streak.md). */
export const DaySchema = z.iso.date()

export const TermProgressSchema = z.object({
  termId: IdSchema,
  box: z.int().min(BOX_MIN).max(BOX_MAX),
  correctCount: CountSchema,
  wrongCount: CountSchema,
  lastWrongAt: TimestampSchema.optional(),
  lastStudiedAt: TimestampSchema.optional(),
  /** The last day `box` went up: at most one step per day (decision #50). */
  lastPromotedDay: DaySchema.optional(),
})

export const StudyDaySchema = z.object({
  date: DaySchema,
  answeredCount: CountSchema,
})

/** Raw values as typed in a form, before normalization. */
export type FolderInput = z.input<typeof FolderInputSchema>
export type FileInput = z.input<typeof FileInputSchema>
export type FileNotesInput = z.input<typeof FileNotesInputSchema>
/** What callers pass in: the list and kind are typed as their values, not as plain strings. */
export type TermInput = Omit<z.input<typeof TermInputSchema>, 'kind' | 'partsOfSpeech'> & {
  kind?: TermKind
  partsOfSpeech?: PartOfSpeech[]
}

export type Folder = z.output<typeof FolderSchema>
export type VocabFile = z.output<typeof VocabFileSchema>
export type Term = z.output<typeof TermSchema>
export type TermProgress = z.output<typeof TermProgressSchema>
export type StudyDay = z.output<typeof StudyDaySchema>
