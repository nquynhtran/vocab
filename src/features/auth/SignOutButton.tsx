export function SignOutButton({ signOut }: { signOut: () => Promise<void> }) {
  // AuthGate removes the app at once whatever the outcome, so no error is shown here.
  return (
    <button
      type="button"
      className="button"
      onClick={() => void signOut().catch((error: unknown) => console.error(error))}
    >
      Sign out
    </button>
  )
}
