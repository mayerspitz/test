# WindWise

Enter any location and a date/period range. WindWise pulls AccuWeather forecasts and produces the approved one-page report: day-by-day breakdown, alerts line, backyard wind table, and a one-page PDF.

> **Standalone branch.** This branch has its own history (no shared commits with `main`) and is never merged. It is deployed on its own to Render.

## Documentation

| File                                           | Read it for                                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| [`docs/STATE.md`](docs/STATE.md)               | **Start here.** Where the project stands, what is verified, what is next     |
| [`AGENTS.md`](AGENTS.md)                       | The working rules — owner rules, documentation rules, secrets, code, deploys |
| [`docs/DECISIONS.md`](docs/DECISIONS.md)       | Every decision and the reasoning behind it                                   |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How the code is laid out and why                                             |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md)     | Render, environment variables, plan tiers, key rotation                      |
| [`docs/HANDOFF.md`](docs/HANDOFF.md)           | The owner's original spec, verbatim                                          |

## Quick start

```bash
pnpm i
cp .env.example .env        # add ACCUWEATHER_API_KEY
pnpm dev                    # API on :8787, web on :5173 (proxied /api)
```

Production, one Node service:

```bash
pnpm build && pnpm start    # serves the built web app and /api on $PORT (default 8787)
```

Requires Node 22.12+ and pnpm 10.

## AccuWeather key

1. Sign up at [developer.accuweather.com](https://developer.accuweather.com) and create an app to get a key.
2. Put it in `.env` (local) or the Render dashboard (hosted). It is used only on the server; the browser never sees it.
3. Keys from the current portal use a Bearer header: set `ACCUWEATHER_AUTH_MODE=bearer`. Older keys use `query`.

## Plans and limits

Source: AccuWeather's Core Weather packages page, checked Sep 24, 2026. Set `ACCUWEATHER_TIER` to your plan. The mapping is in `apps/server/src/config/tiers.ts`.

| Tier             | Price   | Calls      | Daily forecast | Hourly          | Alerts | Report periods                                                         |
| ---------------- | ------- | ---------- | -------------- | --------------- | ------ | ---------------------------------------------------------------------- |
| `free`           | $0      | —          | 5 days         | 12 h (not used) | —      | Day / Night (the safe floor, and the default)                          |
| `trial` (14-day) | $0      | 500/day    | 15 days        | 120 h           | Yes    | Morning / Afternoon / Evening / Overnight                              |
| `starter`        | $2/mo   | 15,000/mo  | 5 days         | 12 h (not used) | —      | Day / Night                                                            |
| `standard`       | $25/mo  | 225,000/mo | 5 days         | 12 h (not used) | —      | Day / Night                                                            |
| `prime`          | $250/mo | 1.8M/mo    | 10 days        | 72 h            | Yes    | Morning / Afternoon / Evening / Overnight, then Day / Night past 72 h  |
| `elite`          | $500/mo | 2.4M/mo    | 15 days        | 120 h           | Yes    | Morning / Afternoon / Evening / Overnight, then Day / Night past 120 h |

AccuWeather's portal describes the 14-day trial as full **Elite**-level Core Weather at 500 calls/day, so `trial` maps to Elite capabilities (see `docs/DECISIONS.md` D-21). `free` is kept as the conservative floor and is the default. If the configured tier claims more than the key allows, the daily request steps down through narrower windows instead of failing (D-22).

One report costs up to 4 calls (location, daily, hourly, alerts); repeat requests are served from cache.

## Configuration

| Variable                | Default                 | Notes                                                    |
| ----------------------- | ----------------------- | -------------------------------------------------------- |
| `ACCUWEATHER_API_KEY`   | —                       | Required for reports                                     |
| `ACCUWEATHER_AUTH_MODE` | `query`                 | `query` or `bearer`                                      |
| `ACCUWEATHER_TIER`      | `free`                  | `free`, `trial`, `starter`, `standard`, `prime`, `elite` |
| `PORT`                  | `8787`                  | Render sets this                                         |
| `WEB_ORIGIN`            | `http://localhost:5173` | Only origin allowed by CORS                              |
| `DEFAULT_UNITS`         | `imperial`              | `imperial` or `metric`                                   |

## Scripts

| Command                                        | Does                                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| `pnpm dev`                                     | Server (tsx watch) and web (Vite) together                             |
| `pnpm build`                                   | Builds web, then bundles the server                                    |
| `pnpm start`                                   | Runs the built server                                                  |
| `pnpm test`                                    | Unit tests (Vitest), all packages                                      |
| `pnpm test:e2e`                                | Playwright smoke test: search → generate → download (mock AccuWeather) |
| `pnpm lint` / `pnpm typecheck` / `pnpm format` | ESLint / TypeScript / Prettier                                         |

The e2e test needs a Chromium: run `pnpm --filter @windwise/web exec playwright install chromium` once, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

## API

| Method | Route               | Body / query                          | Returns                                               |
| ------ | ------------------- | ------------------------------------- | ----------------------------------------------------- |
| GET    | `/api/health`       | —                                     | `{ ok: true }`                                        |
| GET    | `/api/capabilities` | —                                     | `{ tier, maxDailyDays, maxHourlyHours, periodsMode }` |
| GET    | `/api/locations?q=` | city text or zip                      | up to 10 `{ key, name, admin, country }`              |
| POST   | `/api/report`       | `{ locationKey, start, end, units? }` | `Report`                                              |
| POST   | `/api/report/pdf`   | same                                  | one-page PDF, `{City}_Weather_{MonDD}-{MonDD}.pdf`    |

`start`/`end` are local times at the location, `YYYY-MM-DDTHH:mm`; `end` is exclusive (Sun Night ends Mon `06:00`). Ranges outside the forecast window return `400` ("Forecasts available through Sep 29."). A range too long for one page returns `422`. Rate limit: 60 requests/min per IP. Cache: locations 24 h, daily 60 min, hourly 30 min, alerts 10 min.

## Deploy to Render

Live: **https://windwise-h6a1.onrender.com** (Render service `windwise`, workspace Mayer, region Virginia, free plan).

`render.yaml` defines one Docker web service built from this branch (`Dockerfile`), health check `/api/health`, auto-deploy on push.

1. Render → New → Blueprint → this repo, branch `claude/magical-knuth-ufkstw` (or create a Web Service with runtime Docker).
2. Set `ACCUWEATHER_API_KEY` in the service's Environment tab.
3. Set `ACCUWEATHER_TIER` to your plan and `WEB_ORIGIN` to the service URL.

The `free` Render plan sleeps after 15 minutes idle (first request then takes ~1 minute). Use `starter` or above for instant responses.

## Layout

```
apps/server        Fastify API: AccuWeather client, cache, validation, PDF route, static web
apps/web           React one-screen client (Vite, TanStack Query)
packages/shared    Period builder, wind rules engine, buildReport, formatters, PDF document
  wind-rules.json  Backyard table text per wind tier (edit without code changes)
  test/fixtures    Golden fixture: the approved Brooklyn report, Sep 25–27, 2026
```

## Owner decisions needed

Seven open questions, each with a default already shipping, are tracked in
[`docs/STATE.md`](docs/STATE.md#open-questions-for-the-owner) with the reasoning in
[`docs/DECISIONS.md`](docs/DECISIONS.md). Nothing is blocked on them.
