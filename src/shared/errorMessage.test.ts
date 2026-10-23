import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AuthenticationError,
  ConnectionError,
  DuplicateNameError,
  EntityNotFoundError,
  InvalidStoredDataError,
  SessionExpiredError,
  ValidationError,
} from '../domain/errors.ts'
import { errorMessage, UNEXPECTED_ERROR } from './errorMessage.ts'

describe('errorMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    new ValidationError({ name: ['Name is required'] }),
    new DuplicateNameError('folder', 'IELTS'),
    new EntityNotFoundError('file', 'x'),
    new ConnectionError(),
    new SessionExpiredError(),
    new InvalidStoredDataError('folders 0: name', 'value is not normalized'),
    new AuthenticationError('Wrong email or password.'),
  ])('shows the message of $name', (error) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(errorMessage(error)).toBe(error.message)
    expect(log).not.toHaveBeenCalled()
  })

  it('hides and logs anything else, which is a bug', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const bug = new Error('Cloud request failed (XX000): boom')
    expect(errorMessage(bug)).toBe(UNEXPECTED_ERROR)
    expect(log).toHaveBeenCalledWith(bug)
  })
})
