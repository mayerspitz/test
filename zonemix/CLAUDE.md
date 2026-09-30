# Rules for AI contributors to ZoneMix

Read `docs/PROJECT_CONTEXT.md` first, every session.

## Isolation (non-negotiable)

- Work only on the branch your session assigns you, created from `origin/main`. Never merge into `main`. Open no pull request unless the user asks. Push only your own branch.
- Everything lives in this `zonemix/` folder. Files go at the repo root only if a host strictly requires it (e.g. `render.yaml`), kept minimal and pointing into this folder.
- No imports from, symlinks to, or copies of code in other folders or branches. This folder has its own manifest, tests, docs and `.gitignore`.
- **Hosting.** Create hosting services named after the project. Never modify, redeploy or delete other projects' services; on Render, leave `home-audio` and `home-audio-demo` alone.
- **Secrets.** Never commit passwords, tokens or keys. `.env.example` lists names only. Secrets typed in chat go only into env settings and are redacted from logs.
- Relative paths only. Moving the folder to its own repo must need no code changes.

## Documentation discipline

- `docs/PROJECT_CONTEXT.md` holds the user's rules, the environment, the requirements, the numbered decision log, what's built and where it runs, what's verified and what isn't, and next steps.
- Update `PROJECT_CONTEXT.md` and `docs/OPEN_ITEMS.md` in the same commit as any decision, answer or fact they depend on.
- Add each new user message word for word to `docs/history/CONVERSATION_LOG.md`.
- Put facts with sources in `docs/history/RESEARCH_NOTES.md`, marked V (read) or S (search snippet only).
- Every open question goes in `OPEN_ITEMS.md` with a status.
- Don't trust documents from other agents blindly. List where they contradict the user and confirm those points first.

## How this user likes to work

- Don't ask what you can work out. Ask only questions that change the outcome, batched and numbered (P1, P2 …), saying what each answer changes.
- As automatic as possible: one-line installs, self-checks that explain problems in plain English, no manual dashboard steps.
- Quality over convenience.
- Finish, test, then report:
  - run `npm test` before every push;
  - try UIs at phone size in Chromium (Playwright);
  - confirm deploys are live;
  - say plainly what was verified and what wasn't.
- Replies: plain English, outcome first, short tables. Before any purchase, give exact products, quantities, prices and totals. The user is on Android and prefers mobile-first installable web apps.
- Fold mid-task messages into the current work and confirm they were handled.

## Code conventions

- Node.js 22, ES modules, no runtime dependencies unless one clearly earns its place.
- `src/engine/` stays pure: no timers, sockets or clocks. I/O lives in drivers and services, so the simulator and tests drive the real engine code.
- User-facing messages (config errors, alarms) are plain English and say what to do.
- Keep the test count in `README.md` current.
- Commits: clear messages, ending with the session's attribution lines. No model names in commits, code or docs.
