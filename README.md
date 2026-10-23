# Vocab

A personal English vocabulary trainer.

- **Now:** sign-in, folders → files → terms (term, part of speech, meaning, example), a warning when a word already exists, British pronunciation via the browser's speech synthesis, a JSON export of all data, and importing such a file into an empty account.
- **Planned:** installing on iPhone, a Learn mode (multiple choice + typing the answer), a daily study streak, replacing all data from a JSON backup.

**Open the app:** https://nquynhtran.github.io/vocab/

Your vocabulary is stored in Supabase (one account, sign-up disabled), so every device you sign in on shows the same data. The app needs a connection; there is no offline mode. Deleting the account in the Supabase dashboard deletes all its data, so export a JSON backup now and then.

## Run locally

Requires the Node.js version in `.nvmrc` (install it with `nvm install`).

```bash
npm install
npm run dev      # start the dev server
npm run check    # lint + format check + typecheck + tests
npm run build    # production build into dist/ (needs VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY)
npm run test:supabase  # pgTAP + repository contract tests against local Supabase; run `npx supabase start` first (needs Docker)
```

Every push to `main` runs the checks in GitHub Actions and deploys to GitHub Pages.

## Tech stack

TypeScript (strict) · React · Vite · Supabase (Postgres + Auth) · Zod · Vitest · GitHub Pages

## Documentation

Design notes and the progress log are written in Vietnamese: [docs/README.md](docs/README.md) · [PROGRESS.md](PROGRESS.md)
