import { z } from 'zod'
import { normalizeText } from './text.ts'

export const NAME_MAX_LENGTH = 200
export const EXAMPLE_MAX_LENGTH = 500
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

/** A blank example is stored as "no example", so the field is simply absent. */
const ExampleSchema = z
  .string()
  .optional()
  .transform((value) => (value === undefined ? undefined : normalizeText(value) || undefined))
  .pipe(storableText('Example', EXAMPLE_MAX_LENGTH).optional())

/**
 * Stored as these full names; abbreviations ("v.") are display only (features/terms).
 * Removing or renaming a value needs a migration of stored terms and backups. Any change also
 * needs a SQL migration of the `part_of_speech` CHECK in supabase/migrations.
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

/** The form's empty choice '' means "not set", stored as an absent field like a blank example. */
const PartOfSpeechSchema = z
  .enum(['', ...PARTS_OF_SPEECH], { error: 'Choose a part of speech from the list' })
  .optional()
  .transform((value) => value || undefined)
  .pipe(z.enum(PARTS_OF_SPEECH).optional())

const IdSchema = z.uuid()
export const TimestampSchema = z.iso.datetime()
const CountSchema = z.int().min(0)

export const FolderInputSchema = z.object({ name: requiredText('Name', NAME_MAX_LENGTH) })
export const FileInputSchema = z.object({ name: requiredText('Name', NAME_MAX_LENGTH) })
export const TermInputSchema = z.object({
  word: requiredText('Term', NAME_MAX_LENGTH),
  partOfSpeech: PartOfSpeechSchema,
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

export const TermProgressSchema = z.object({
  termId: IdSchema,
  box: z.int().min(BOX_MIN).max(BOX_MAX),
  correctCount: CountSchema,
  wrongCount: CountSchema,
  lastWrongAt: TimestampSchema.optional(),
  lastStudiedAt: TimestampSchema.optional(),
})

export const StudyDaySchema = z.object({
  date: z.iso.date(),
  answeredCount: CountSchema,
})

/** Raw values as typed in a form, before normalization. */
export type FolderInput = z.input<typeof FolderInputSchema>
export type FileInput = z.input<typeof FileInputSchema>
export type TermInput = z.input<typeof TermInputSchema>

export type Folder = z.output<typeof FolderSchema>
export type VocabFile = z.output<typeof VocabFileSchema>
export type Term = z.output<typeof TermSchema>
export type TermProgress = z.output<typeof TermProgressSchema>
export type StudyDay = z.output<typeof StudyDaySchema>
