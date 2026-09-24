# CLAUDE.md

WindWise — a one-page AccuWeather report app. Owner: Mayer (Techonsoft Inc).

**Start here:** `docs/STATE.md` (where things stand) → `AGENTS.md` (the rules) →
`docs/DECISIONS.md` (why things are the way they are).

@AGENTS.md

---

## The three rules that get broken most

1. **Never change anything the owner has already seen and approved** — layout, columns, wording,
   order — unless he asks. An agent once removed an approved column unasked; that is why this is
   rule 1 (D-10, D-11).
2. **Document every decision with its reasoning** in `docs/DECISIONS.md`, and update `docs/STATE.md`
   in the same commit as the work. The repo is the memory; a chat transcript is not.
3. **Never commit the AccuWeather key.** It lives in Render's environment and an untracked `.env`.

## Fast facts

|                   |                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Stack             | pnpm monorepo · Fastify + TypeScript · React + Vite · `@react-pdf/renderer` · no database |
| Live              | https://windwise-h6a1.onrender.com (Render service `windwise`, free plan)                 |
| Deploy branch     | see `docs/OPERATIONS.md` — only that branch ships                                         |
| Checks            | `pnpm test` · `pnpm typecheck` · `pnpm lint` · `pnpm format:check`                        |
| Contract          | `packages/shared/test/report.golden.test.ts` reproduces the owner's approved report       |
| Blocked from here | `dataservice.accuweather.com` and `onrender.com` — the sandbox cannot reach either        |
