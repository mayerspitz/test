# Current state

**Updated:** Sep 24, 2026 · Keep this file current — it is the first thing the next agent reads.

> **Branch:** everything lives on `claude/magical-knuth-ufkstw`, the branch Render deploys from.
> If your session was assigned a different branch name, fast-forward this one when your work is
> ready and delete yours (D-34).

## In one paragraph

WindWise is built, tested and deployed. All six milestones from `docs/HANDOFF.md` are done. 63 unit
tests and one Playwright smoke test pass; the golden fixture reproduces the owner's approved Brooklyn
report and the PDF renders on exactly one landscape page. The app is live on Render and the
AccuWeather key is now set, so reports should work end to end — **but no one has yet confirmed a
report on real AccuWeather data, confirmed by the owner on Sep 25, 2026**: a Brooklyn Fri–Sun
report rendered 12 four-period rows with live alerts (Coastal Flood Watch, Wind Advisory, Rip
Current Statement), sunrise/sunset and a worst window. That confirms the key, the Bearer auth mode
and `ACCUWEATHER_TIER=trial` all work against the real API.

## Milestones

| #   | Milestone                                               | Status |
| --- | ------------------------------------------------------- | ------ |
| M1  | Monorepo scaffold, lint, tests, `pnpm dev`              | done   |
| M2  | AccuWeather client, cache, location search              | done   |
| M3  | Period builder, wind engine, `buildReport` + unit tests | done   |
| M4  | `/api/report` + HTML preview                            | done   |
| M5  | Server PDF, one-page guarantee                          | done   |
| M6  | Error handling, rate limit, mobile polish, README       | done   |

## Acceptance criteria

| #   | Criterion                                                    | Status                                                                    |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| 1   | Any location → report in <3s (cached <300ms)                 | **unverified live.** Also: the free Render plan's cold start takes ~1 min |
| 2   | Ranges in the window accepted; outside → clear error         | done, covered by tests                                                    |
| 3   | PDF always exactly one page, landscape Letter                | done, asserted in tests                                                   |
| 4   | Column sets and order match the approved report              | done, golden fixture asserts it character-for-character                   |
| 5   | Missing periods listed in data gaps; nothing invented        | done                                                                      |
| 6   | Alerts, sunrise/sunset, worst window appear when data exists | done (alerts need a plan that includes them)                              |
| 7   | The API key never reaches the browser                        | done by construction — the client only calls `/api/*`                     |
| 8   | Works on mobile Safari/Chrome                                | verified in Playwright at mobile and desktop viewports                    |
| 9   | `pnpm test` green; one e2e smoke test                        | done — 63 unit tests, 1 e2e                                               |

## Verified, and how

- `pnpm test` → **76 passing** (45 shared, 20 server, 11 web).
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` → clean.
- Playwright smoke (search → generate → download PDF) passes at desktop **and** mobile viewports,
  against a mock AccuWeather.
- The golden Brooklyn PDF was rendered and inspected: one landscape page, layout as approved.
- A clean checkout runs the Dockerfile's steps (frozen install → build → start) successfully.
- Render's logs show the deployed app serving the page, its assets, and `/api/capabilities`.

## Not verified

- **The live site from an agent.** `onrender.com` and `dataservice.accuweather.com` are blocked by
  the sandbox's network policy, so every automated test still runs against a mock. The owner has
  since confirmed a real report by hand (see below), which is the live proof the tests cannot give.
- **The Docker image build itself.** Base images could not be pulled from the sandbox, so the
  Dockerfile's _steps_ were reproduced by hand in a clean checkout rather than built. Render builds
  the image successfully, which is the real proof.

## Next steps, highest value first

1. **Set the health check path** to `/api/health` in Render → Settings. It is still blank, so Render
   is not restarting a hung instance. **An agent cannot do this** — see `docs/OPERATIONS.md`.
2. **Answer the open questions below.** Each is a small contained edit, blocked only on an answer.
3. **Before Oct 8, 2026:** the trial expires. Set `ACCUWEATHER_TIER` to the plan bought, or back to
   `free`. Reports keep working either way (D-22), but they lose the 4-period rows and alerts.

## Open questions for the owner

Nothing here is blocked on engineering. Each has a documented default that ships today.

| #   | Question                                                                                    | Default in place                                    | Decision |
| --- | ------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------- |
| Q1  | Which plan replaces the trial when it ends Oct 8? (tier itself: answered — `trial` is live) | `trial` now; falls back to `free`                   | D-33     |
| Q2  | Approve the Breezy / Gale / Storm backyard wording?                                         | Drafted but hidden; those tiers show a summary line | D-31     |
| Q3  | Sukkah row year-round, or only during Sukkot?                                               | Year-round                                          | D-30     |
| Q4  | "Fri AM" prose ("Rising to upper 60s" / "Low") or numbers?                                  | Numbers: `68° (66°)`, `10%`                         | D-27     |
| Q5  | `(~N hrs)` on every row, or Day/Night only as in your sample?                               | Day/Night only                                      | D-28     |
| Q6  | Backyard header rounding — "At 20 mph" / "At 35–40 mph" acceptable?                         | Nearest 5 mph; gusts as a 5 mph band                | D-29     |
| Q7  | A custom domain, or is the `onrender.com` URL fine?                                         | `onrender.com`                                      | —        |
| Q8  | Pay for Render Starter to kill the ~1 minute cold start?                                    | Free plan, sleeps after 15 min idle                 | —        |

## Deliberately not built (v1 scope)

Database, user accounts, saved reports, scheduling, notifications — all out of scope per D-14.
The handoff also notes a possible future **import** path: uploading AccuWeather pages, which is how
the first report was made. It gives the most exact period detail with no plan limits, and is worth
reconsidering only if the API plan proves too restrictive.
