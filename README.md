# Noir Portfolio

My personal portfolio built with Next.js, TypeScript, and Tailwind CSS.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- pnpm

## Development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000` to view the site locally.

## Scripts

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
```

## Firestore emulator integration tests

Install Java 21 or newer, then run:

```powershell
pnpm test:integration
```

The runner creates an ignored `.env.test` from `.env.test.example` when needed.
It is pinned to the local `demo-noir-portfolio` emulator and refuses Firebase
service-account credentials, production project IDs, Resend keys, and Google
refresh tokens. No real Firebase key is required.

## Notes

This is a private personal project. Local planning artifacts, OpenSpec files, and agent configuration are intentionally excluded from version control.
