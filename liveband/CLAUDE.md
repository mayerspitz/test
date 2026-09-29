# Rules for AI agents working on LiveBand

Read `docs/PROJECT_CONTEXT.md` first. It is the single source of truth.
The full original handoff documents (PDF + text) are in `docs/handoff/`. This file
copies sections 1, 3 and 4 of "New Project Handoff". Sections 2 (layout), 5 (tooling),
6 (moving to its own repo) and 7 (first steps) are there in full.

## 1. Isolation (non-negotiable)

1. **Branch:** work only on the branch your session assigns you. Create it from
   `origin/main`, never from another `claude/*` branch. Never merge into `main`. Open no
   pull request unless the owner asks. Push only your own branch.
2. **One top-level folder:** everything lives in `liveband/`. Files go at the repo root
   only if a host strictly requires it (e.g. a `render.yaml`), kept minimal and
   pointing into this folder.
3. **Nothing shared:** no imports from, symlinks to, or copies of code in other folders
   or branches. This folder has its own dependency manifest, lockfile, tests, docs and
   `.gitignore`.
4. **Deployment:** create our own hosting services, named after the project. Never
   modify, redeploy or delete other projects' services (on Render, leave `home-audio`
   and `home-audio-demo` alone).
5. **Secrets:** never commit passwords, tokens or keys. Put them in the host's
   environment variables. `.env.example` lists names only. If the owner types a secret in
   chat, use it only in environment settings, and redact it in any log.
6. **Easy to extract:** relative paths only; no assumptions about the parent repo.

## 2. Documentation: nothing gets lost

- `docs/PROJECT_CONTEXT.md` holds the owner's rules, environment, requirements, a
  numbered decision log (date, decision, why, alternatives), what's built and where it
  runs, what's verified and what isn't, and next steps.
- When a decision, answer or fact changes, update `PROJECT_CONTEXT.md` and
  `OPEN_ITEMS.md` in the same commit. Add each new owner message, word for word, to
  `docs/history/CONVERSATION_LOG.md`.
- Every open question goes in `OPEN_ITEMS.md` with a status.
- Documents from other agents: don't trust them blindly. List where they contradict
  what the owner has said since, and confirm with the owner before building on them.

## 3. How the owner likes to work

- Don't ask what you can work out. Ask only questions that change the outcome, batched
  and numbered (P1, P2…), each saying what it changes.
- As automatic as possible: one-line installs, plain-English self-checks, no manual
  dashboard steps (work around a host's API limits in code).
- Quality over convenience.
- Finish, test, then report: run the full suite before every push, try UIs in a real
  browser at phone size (Playwright + Chromium are preinstalled), confirm deploys are
  live.
- Be honest about limits.
- Replies: plain English, outcome first, short tables and lists. Before any purchase,
  give exact products, quantities, approximate prices and totals.
- The owner uses Android and prefers mobile-first, installable web apps.
- Mid-task messages: fold them in without dropping the current work, and confirm they
  were handled.
- Commits: clear messages ending with the session's attribution lines. No model names in
  commits, code or docs.
