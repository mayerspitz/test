# Architecture

One pnpm monorepo, three workspaces, no database. In production it is a **single Node process**:
Fastify serves the API and the built React bundle on one port.

```
browser ──GET /, /assets/*──────────────> Fastify static  (apps/server)
        ──GET  /api/locations?q=────────> AccuWeather /locations/v1/*
        ──POST /api/report─────────────┐
        ──POST /api/report/pdf─────────┤   report-service
                                       ├─> AccuWeather /forecasts/v1/daily  (required)
                                       ├─> AccuWeather /forecasts/v1/hourly (optional, plan-gated)
                                       └─> AccuWeather /alerts/v1           (optional, plan-gated)
                                              │
                                              v
                                       buildReport()  ── pure, in packages/shared
                                              │
                                   ┌──────────┴──────────┐
                                   v                     v
                              Report JSON          ReportPdf → one-page PDF
```

The AccuWeather key never leaves the server (D-18). The client only ever talks to `/api/*`.

## Workspaces

| Path              | Package            | Holds                                                                       |
| ----------------- | ------------------ | --------------------------------------------------------------------------- |
| `packages/shared` | `@windwise/shared` | All report logic. Pure, no I/O, no Fastify, no React DOM. Fully unit-tested |
| `apps/server`     | `@windwise/server` | Fastify app, AccuWeather HTTP client, cache, zod validation, PDF route      |
| `apps/web`        | `@windwise/web`    | The one-screen React client                                                 |

**The rule that keeps this sane:** anything that decides _what the report says_ lives in `shared`
and is a pure function. The server only fetches and serves; the client only renders. A change to
report content that touches `apps/` is almost always in the wrong place.

## `packages/shared` — the report logic

| File                | Responsibility                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `accuweather.ts`    | Types for the raw AccuWeather payloads (`AwDaily`, `AwHour`, `AwAlert`, `AwLocation`)                             |
| `periods.ts`        | Hourly rows → Morning / Afternoon / Evening / Overnight buckets in the location's local time; daily → Day / Night |
| `range.ts`          | `slotsInRange()` — turns a start/end pair into the list of period slots to include                                |
| `wind.ts`           | Gust → tier, the backyard table, the summary line, the rule-of-thumb line, header rounding (D-29)                 |
| `wind-rules.json`   | **The backyard wording itself.** Edited without touching code; `approved: false` hides a tier's table (D-31)      |
| `report.ts`         | `buildReport(daily, hourly, alerts, location, range, opts)` — the pure function the whole app funnels through     |
| `format.ts`         | Temperature, rain, wind and date formatting, including `(~N hrs)` placement (D-28)                                |
| `pdf/ReportPdf.tsx` | The `@react-pdf/renderer` document. Also exports `countPdfPages()` used to assert the one-page rule               |

### Period buckets (local time at the location)

| Period    | Hours       | Temp aggregation                        |
| --------- | ----------- | --------------------------------------- |
| Morning   | 06:00–11:59 | max                                     |
| Afternoon | 12:00–16:59 | max                                     |
| Evening   | 17:00–21:59 | value at bucket start                   |
| Overnight | 22:00–05:59 | min (belongs to the day it _starts_ on) |

Conditions come from the hour with the highest precipitation probability, else the most frequent
`IconPhrase`. Wind is max sustained with the most frequent direction; gusts are the max. Rain
amount is summed; rain chance is the max.

### The one-page guarantee (D-8, D-19)

`POST /api/report/pdf` renders, counts pages, and if it overflows re-renders at a smaller table
font: **7.8 → 7.3 → 6.8pt**. If 6.8pt still overflows it returns **422 "Range too long for one page
— shorten it."** It never returns a two-page PDF. Do not relax this to "usually one page".

## `apps/server`

| File                    | Responsibility                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `index.ts`              | Process entry: load config, build app, listen                                                       |
| `app.ts`                | Routes, CORS (`WEB_ORIGIN` only), rate limit (60/min/IP), static web serving, error mapping         |
| `config/env.ts`         | zod-validated environment. Blank values fall back to defaults so an empty Render var is not a crash |
| `config/tiers.ts`       | Plan → capabilities, and `DAILY_WINDOWS`, the step-down ladder (D-21, D-22)                         |
| `accuweather/client.ts` | HTTP client: auth mode, caching, in-flight de-duplication, 10s timeout, error translation           |
| `cache.ts`              | LRU + TTLs: locations 24 h, daily 60 min, hourly 30 min, alerts 10 min                              |
| `report-service.ts`     | Range validation, the daily step-down ladder, optional hourly/alerts, then `buildReport`            |

### Failure handling

| Upstream                   | Becomes                                                       | Why                                                   |
| -------------------------- | ------------------------------------------------------------- | ----------------------------------------------------- |
| 401 / 403 on **daily**     | Retry a narrower window; only fail if every window is refused | D-22 — a misconfigured tier should degrade, not break |
| 401 / 403 on hourly/alerts | Silently omitted, recorded in the data-gaps note              | The plan simply does not include it (D-25)            |
| 429 / 503                  | `503 "Daily API limit reached"`                               | Quota, not a bug                                      |
| 400 / 404                  | `404 "Location not found."`                                   |                                                       |
| timeout                    | `504 "AccuWeather did not respond. Try again."`               | 10s ceiling                                           |

The client logs the **path and status only, never the URL**, because a `query`-mode URL carries the
API key.

## `apps/web`

One screen: `LocationSearch` (300ms debounce) → `RangePicker` (bounded by `/api/capabilities`) →
`UnitsToggle` → `ReportView`. The HTML preview deliberately mirrors the PDF's column order and style
tokens, so what the owner sees is what downloads. Tables scroll horizontally on narrow screens; the
owner works on mobile often.

## Testing

| Suite                    | Covers                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `packages/shared/test`   | Period building, wind tiers, formatters, the PDF page count, and the **golden fixture**    |
| `apps/server/test`       | Every route, validation, error mapping, rate limit, caching, and the plan step-down ladder |
| `apps/web/src/*.test.ts` | Date/range helpers                                                                         |
| `apps/web/e2e`           | One Playwright smoke test against a mock AccuWeather: search → generate → download         |

**The golden fixture is the contract.** `packages/shared/test/fixtures/*.json` is hand-built raw
AccuWeather-shaped data that reproduces the owner's approved Brooklyn report. `report.golden.test.ts`
asserts the period rows and the Windy backyard table character-for-character. If that test fails, the
output drifted from what the owner approved — fix the code, never the fixture, unless the owner asked
for the change (D-11).
