import { z } from 'zod'
import { normalizeText } from './text.ts'

export const NAME_MAX_LENGTH = 200
export const EXAMPLE_MAX_LENGTH = 500
export const BOX_MIN = 1
export const BOX_MAX = 5

/** Normalizes first so the length limits apply to what is actually stored. */
function requiredText(label: string, max: number) {
  return z
    .string()
    .transform(normalizeText)
    .pipe(
      z
        .string()
        .min(1, { error: `${label} is required` })
        .max(max, { error: `${label} must be at most ${max} characters` }),
    )
}

/** A blank example is stored as "no example", so the field is simply absent. */
const ExampleSchema = z
  .string()
  .optional()
  .transform((value) => (value === undefined ? undefined : normalizeText(value) || undefined))
  .pipe(
    z
      .string()
      .max(EXAMPLE_MAX_LENGTH, {
        error: `Example must be at most ${EXAMPLE_MAX_LENGTH} characters`,
      })
      .optional(),
  )

const IdSchema = z.uuid()
const TimestampSchema = z.iso.datetime()
const CountSchema = z.int().min(0)

export const FolderInputSchema = z.object({ name: requiredText('Name', NAME_MAX_LENGTH) })
export const FileInputSchema = z.object({ name: requiredText('Name', NAME_MAX_LENGTH) })
export const TermInputSchema = z.object({
  word: requiredText('Term', NAME_MAX_LENGTH),
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
