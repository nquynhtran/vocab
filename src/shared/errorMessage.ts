import { AuthenticationError } from '../data/auth.ts'
import {
  ConnectionError,
  DuplicateNameError,
  EntityNotFoundError,
  InvalidStoredDataError,
  SessionExpiredError,
  ValidationError,
} from '../domain/errors.ts'

export const UNEXPECTED_ERROR = 'Something went wrong. Please try again.'

/** These carry a message written for the user; anything else is a bug. */
const EXPECTED_ERRORS = [
  ValidationError,
  DuplicateNameError,
  EntityNotFoundError,
  ConnectionError,
  SessionExpiredError,
  InvalidStoredDataError,
  AuthenticationError,
]

export function errorMessage(error: unknown): string {
  if (EXPECTED_ERRORS.some((type) => error instanceof type)) return (error as Error).message
  console.error(error)
  return UNEXPECTED_ERROR
}
