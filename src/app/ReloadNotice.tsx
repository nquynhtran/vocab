/**
 * Replaces the whole app, so this tab's old code cannot write in a shape newer code no longer
 * expects. `automatic: false` when an automatic reload would just load the same old build again.
 */
export function ReloadNotice({ automatic = true }: { automatic?: boolean }) {
  return (
    <main className="page">
      {automatic ? (
        <p role="alert">A new version is available. Reloading…</p>
      ) : (
        <>
          <p role="alert">
            A new version is available but not online yet. Try again in a few minutes.
          </p>
          <button type="button" className="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </>
      )}
    </main>
  )
}
