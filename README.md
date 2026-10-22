# Vocab

A personal English vocabulary trainer with a single Learn mode (multiple choice + typing the answer) and a daily study streak.

**Open the app:** https://nquynhtran.github.io/vocab/

Your vocabulary is stored only in your browser (IndexedDB) and is never sent to a server. Clearing your browser data deletes it, so back it up with the JSON export (planned).

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
