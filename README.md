# Vocab

A personal English vocabulary trainer.

- **Now:** folders → files → terms (term, part of speech, meaning, example), a warning when a word already exists, British pronunciation via the browser's speech synthesis, and a JSON export of all data.
- **Planned:** sync between computer and phone, a Learn mode (multiple choice + typing the answer), a daily study streak, restoring from a JSON backup.

**Open the app:** https://nquynhtran.github.io/vocab/

For now your vocabulary is stored only in the browser you typed it in (IndexedDB) and is never sent to a server, so another device shows none of it. Clearing browser data deletes it, and iPhone Safari clears it after 7 days without a visit.

## Run locally

Requires the Node.js version in `.nvmrc` (install it with `nvm install`).

```bash
npm install
npm run dev      # start the dev server
npm run check    # lint + format check + typecheck + tests
npm run build    # production build into dist/
```

Every push to `main` runs the checks in GitHub Actions and deploys to GitHub Pages.

## Tech stack

TypeScript (strict) · React · Vite · Dexie (IndexedDB) · Zod · Vitest · GitHub Pages

## Documentation

Design notes and the progress log are written in Vietnamese: [docs/README.md](docs/README.md) · [PROGRESS.md](PROGRESS.md)
