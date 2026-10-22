/** Replaces the whole app, so this tab's old code cannot write to the upgraded database. */
export function ReloadNotice() {
  return (
    <main className="page">
      <p role="alert">A new version is available. Reloading…</p>
    </main>
  )
}
