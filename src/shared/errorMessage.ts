import { UserFacingError } from '../domain/errors.ts'

export const UNEXPECTED_ERROR = 'Something went wrong. Please try again.'

/** Domain errors carry a message written for the user; anything else is a bug. */
export function errorMessage(error: unknown): string {
  if (error instanceof UserFacingError) return error.message
  console.error(error)
  return UNEXPECTED_ERROR
}
