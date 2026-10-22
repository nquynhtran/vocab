/** Time and ids are passed in, so tests (and the shared contract suite) stay deterministic. */
export interface RepositoryDeps {
  now: () => Date
  newId: () => string
}

export const defaultDeps: RepositoryDeps = {
  now: () => new Date(),
  newId: () => crypto.randomUUID(),
}
