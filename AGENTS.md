# Working rules for agents on WindWise

Canonical ruleset. `CLAUDE.md` imports this file — edit here, not there.

Read this, then `docs/STATE.md`. Together they should be enough to pick up mid-task with no other
context.

---

## 1. Owner rules — non-negotiable

| #   | Rule                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Never change anything the owner has already seen and approved** — layout, columns, wording, order — unless he asks. This rule exists because an agent once deleted an approved column unasked. See D-10 / D-11 |
| 2   | The PDF is **exactly one page**, landscape Letter. Hard requirement, no "usually"                                                                                                                                |
| 3   | Concise, direct, table-first. No filler text in the UI, the PDF, or these docs                                                                                                                                   |
| 4   | Deliver complete working files, never partial stubs                                                                                                                                                              |
| 5   | Where the spec is unclear, **ask the owner. Do not improvise.** If you must proceed, pick a default, ship it, and write it into `docs/DECISIONS.md` §C so it is visible and reversible                           |
| 6   | **Never invent weather data.** A period with no data is listed in the data-gaps note and left out                                                                                                                |

## 2. Documentation rules

The repo is the memory. A decision that exists only in a chat transcript is lost.

- **Every decision goes in `docs/DECISIONS.md`, with its reasoning**, not just what was chosen.
  Append; never rewrite history. Reversing a decision means adding a new entry and marking the old
  one `SUPERSEDED BY D-nn`.
- **Update `docs/STATE.md` in the same commit as the work it describes.** Status that lags the code
  is worse than no status.
- Record what you **could not** verify as plainly as what you did. `docs/STATE.md` has a
  "Not verified" section; keep it honest.
- When a doc and the code disagree, the code is true and the doc is a bug — fix the doc.
- Docs live in `docs/`, are Markdown, and are written for a stranger. No in-jokes, no "as discussed".

| File                   | What belongs in it                                                          |
| ---------------------- | --------------------------------------------------------------------------- |
| `docs/STATE.md`        | Where the project stands right now, what is next, what is unverified        |
| `docs/DECISIONS.md`    | Every decision and its reasoning, append-only                               |
| `docs/ARCHITECTURE.md` | How the code is laid out and why; the rules that keep it coherent           |
| `docs/OPERATIONS.md`   | Render, env vars, tiers, key rotation, deploys, troubleshooting             |
| `docs/HANDOFF.md`      | The owner's original spec, **verbatim**. Never edit it — it is the contract |
| `README.md`            | Getting started and the API surface. Points at `docs/` for everything else  |

## 3. Secrets

- The AccuWeather key lives **only** in Render's environment and a local untracked `.env`.
- **Never** commit it, put it in a PR body or commit message, log it, or echo it into a transcript.
- The HTTP client logs the request path and status, never the URL — a `query`-mode URL carries the
  key. Keep it that way.
- If a key is exposed, rotate it in the portal first, then clean up.

## 4. Code rules

- Report logic is a **pure function in `packages/shared`**. If you are changing what the report says
  by editing `apps/`, you are almost certainly in the wrong file.
- Backyard wording lives in `packages/shared/wind-rules.json`, not in code. A tier with
  `"approved": false` renders its summary line only — that gate is rule 1 made mechanical.
- **The golden fixture is the contract.** If `report.golden.test.ts` fails, the output drifted from
  what the owner approved. Fix the code. Change the fixture only when the owner asked for the change.
- Never fail a report on data the plan simply does not include — omit it and note the gap. The daily
  forecast steps down through narrower windows rather than erroring (D-22).
- Before pushing: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`. All clean.

## 5. Deployment

- Render auto-deploys from **one** branch (see `docs/OPERATIONS.md`). Work that lands on any other
  branch is not deployed, however green its tests are. Check which branch the service points at
  before claiming something is live.
- WindWise branches share **no history** with `main`, which is an unrelated project. Do not merge
  them (D-26).
- The agent sandbox's network policy blocks `dataservice.accuweather.com` and `onrender.com`. You
  cannot test the live app or the real API from here. Use Render's logs, and say so when you could
  not check.

## 6. Reporting back

- Say what is done, what is not, and what you could not verify. Never describe a mock-backed test as
  proof the real thing works.
- Surface decisions that need the owner with the default you shipped, so nothing blocks on an answer.
