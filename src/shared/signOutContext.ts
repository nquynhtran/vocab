import { createContext, useContext } from 'react'

/** Provided by AuthGate. Absent when the app is rendered on its own (tests). */
export const SignOutContext = createContext<(() => Promise<void>) | null>(null)

export function useSignOut(): (() => Promise<void>) | null {
  return useContext(SignOutContext)
}
