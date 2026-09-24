# HANDOFF — Weather Report App ("WindWise")

**Owner:** Mayer (Techonsoft Inc) · **Status:** Ready to build · **Date:** Sep 24, 2026
**Audience:** The next coding agent. Build exactly what is specified here. Where something is unclear, **ask the owner. Do not improvise.**

---

## 0. Owner Rules (read first)

| #   | Rule                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Never change anything the owner did not ask for** once they've seen and approved it: layout, columns, wording, order. Changes happen only when requested. |
| 2   | Output must be **one page** (landscape Letter PDF). This is a hard requirement.                                                                             |
| 3   | Concise, direct, table-first. No filler text in the UI or the PDF.                                                                                          |
| 4   | Deliver complete, working files, not partial stubs.                                                                                                         |

---

## 1. What We're Building

A web app where the user enters **any location** and **any date/time range within the forecast window**. The app pulls **AccuWeather API** data and produces the same one-page report the owner already approved:

1. **Header:** location, date range, a one-line "story" summary.
2. **Day-by-Day Breakdown table:** periods (Morning / Afternoon / Evening / Overnight) with Temp (RealFeel), Conditions, Wind/Gusts, Rain chance, Rain amount.
3. **Alerts line:** active alerts (coastal flood, rip current, etc.), sunrise/sunset, worst window, and a data-gaps note.
4. **Wind Strength — What Happens in Your Backyard:** summary line plus a 4-column table.
5. **Rule of thumb** line plus source line.
6. **Download PDF** (one page, identical to the on-screen view).

**Out of scope for v1:** database, user accounts, saved reports, scheduling, notifications.

---

## 2. Reference Output (approved — match this)

The approved PDF is `Brooklyn_Weekend_Weather_Sep25-27.pdf`. Its content, which also serves as the **golden test fixture**:

### 2.1 Day-by-Day table (columns, exact order)

| Day / Period  | Temp (RealFeel)     | Conditions                               | Wind / Gusts | Rain chance | Rain amount          |
| ------------- | ------------------- | ---------------------------------------- | ------------ | ----------- | -------------------- |
| Fri AM        | Rising to upper 60s | Some sun, clouds building                | NNE 20 / 35  | Low         | 0.00"                |
| Fri Afternoon | 69° (68°)           | Mostly cloudy, windy                     | NNE 20 / 35  | 25%         | 0.00"                |
| Fri Evening   | 62° (56°)           | Mostly cloudy, breezy, a little rain     | NNE 15 / 28  | 55%         | 0.02"                |
| Fri Overnight | Low 58° (51°)       | Mostly cloudy, touch of rain             | N 15 / 28    | 55%         | 0.04" night (~2 hrs) |
| Sat Day       | High 69° (66°)      | Cloudy and windy, a bit of rain          | N 20 / 38    | 55%         | 0.04" (~1.5 hrs)     |
| Sat Evening   | 58° (47°)           | Windy with periods of rain               | WNW 21 / 32  | 70%         | 0.12"                |
| Sat Overnight | Low 57° (47°)       | Windy, periods of rain; ponding on roads | NNW 20 / 32  | 91%         | 0.24" night (~3 hrs) |
| Sun Afternoon | 66° (62°)           | Cloudy, breezy, a little rain            | NNW 15 / 28  | 55%         | 0.02"                |
| Sun Evening   | 60° (56°)           | Mostly cloudy, chance of rain            | NNW 13 / 22  | 35%         | 0.00"                |

### 2.2 Backyard table (columns, exact order — all 4 are required)

| Item                               | At {sustained} mph (sustained) | At {gustLow}–{gustHigh} mph (gusts)        | Action                                              |
| ---------------------------------- | ------------------------------ | ------------------------------------------ | --------------------------------------------------- |
| Patio umbrella, pop-up canopy      | Strains, pulls on base/legs    | **Tips, flips, or launches**               | Close and strap, or take down                       |
| Sukkah                             | Walls billow, schach shifts    | **Walls act like sails; schach blows off** | Anchor frame, tie walls, secure schach              |
| Light chairs, cushions, toys, pots | Slide or wobble                | **Blow away or tip**                       | Bring in or group against a wall                    |
| Trash bins, grill cover            | Lids and cover flap            | Tip over / blow off                        | Weight bins; remove cover                           |
| Trampoline                         | Can shift                      | **Can lift and flip**                      | Stake down or flip over                             |
| Trees, fence, shed                 | Sway / fine                    | Twigs drop; loose panels rattle            | Secure loose panels; avoid parking under dead limbs |

Column headers are **dynamic**: they use the report's max sustained wind and gust range.

### 2.3 Visual style

- Landscape US Letter, margins ~0.4".
- Title 15pt bold; section headings 11pt navy `#1f3a5f`; body/table 7.8pt.
- Table header background navy `#1f3a5f` with white bold text; zebra rows white / `#eef2f7`; 0.3pt grey grid.
- Bold the high-risk cells (gust column) as shown above.

---

## 3. Architecture

**Monorepo (pnpm workspaces), TypeScript everywhere, no DB.**

```
windwise/
├─ apps/
│  ├─ server/        # Node 20+, Fastify, TypeScript
│  └─ web/           # React 18 + Vite + TypeScript
├─ packages/
│  └─ shared/        # types, period builder, wind rules engine, report model, PDF doc
├─ .env.example
├─ package.json      # pnpm workspaces, root scripts
└─ README.md
```

| Layer       | Choice                                            | Why                                                |
| ----------- | ------------------------------------------------- | -------------------------------------------------- |
| Server      | Fastify + TS, `zod` validation                    | Fast and typed; hides the API key from the browser |
| HTTP client | Native `fetch` (Node 20)                          | No extra dependency                                |
| Cache       | In-memory LRU (`lru-cache`) with TTL              | Saves API calls; no DB needed                      |
| Client      | React + Vite + TS, TanStack Query                 | Simple data fetching and caching                   |
| Styling     | Plain CSS modules (or Tailwind)                   | Keep it light                                      |
| PDF         | `@react-pdf/renderer`, **rendered on the server** | Deterministic single page; same component model    |
| Tests       | Vitest (unit), Playwright (1 e2e smoke test)      | Standard                                           |
| Lint/format | ESLint + Prettier                                 | Standard                                           |

**Rule:** the AccuWeather key lives **only on the server**. The client never calls AccuWeather directly.

---

## 4. AccuWeather API Integration

> ⚠️ **Verify every endpoint, parameter, auth method, and tier limit against the current AccuWeather developer docs before coding** (developer.accuweather.com). The shapes below are the known v1 patterns; confirm them.

**Base URL:** `https://dataservice.accuweather.com`
**Auth:** API key (query `apikey=` on classic keys; newer keys may use an `Authorization: Bearer` header). Support both via config.

| Purpose                | Endpoint                                                                                | Notes                                                                                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Search location (text) | `GET /locations/v1/cities/search?q={query}`                                             | Returns `Key`, `LocalizedName`, `AdministrativeArea`, `Country`, `TimeZone`                                                                                        |
| Search by zip          | `GET /locations/v1/postalcodes/search?q={zip}`                                          | Same shape                                                                                                                                                         |
| Autocomplete           | `GET /locations/v1/cities/autocomplete?q={partial}`                                     | For the search box                                                                                                                                                 |
| Daily forecast         | `GET /forecasts/v1/daily/{5day\|10day}/{locationKey}?details=true`                      | Day/Night objects: `LongPhrase`, `RealFeelTemperature`, `Wind`, `WindGust`, `RainProbability`, `Rain`, `HoursOfRain`, `CloudCover`; plus `Sun`, `Moon`, `Headline` |
| Hourly forecast        | `GET /forecasts/v1/hourly/{12hour\|24hour\|72hour\|120hour}/{locationKey}?details=true` | Needed to build Morning/Afternoon/Evening/Overnight. **Longer windows require paid tiers.**                                                                        |
| Alerts                 | `GET /alerts/v1/{locationKey}?details=true`                                             | Coastal flood, rip current, etc. Availability varies by tier and region                                                                                            |

Always pass `details=true` and `language=en-us`. Units: imperial by default, with a metric toggle.

### 4.1 Tier-aware behavior (important)

The server reads `ACCUWEATHER_TIER` from env and exposes its capabilities to the client:

| Capability  | If hourly covers the range                                    | If only daily is available                              |
| ----------- | ------------------------------------------------------------- | ------------------------------------------------------- |
| Periods     | Morning / Afternoon / Evening / Overnight (built from hourly) | **Day / Night** only                                    |
| Report note | none                                                          | "Period detail limited by API plan; showing Day/Night." |

Never fabricate data for missing periods. Omit them and list them in the **data-gaps note** (the same style as the approved PDF: _"Sat morning and Sun morning/night were not in the uploaded pages."_ → _"…were not available from the forecast."_).

---

## 5. Period Builder (`packages/shared/periods.ts`)

Local-time buckets, using the location's `TimeZone`:

| Period    | Hours (local)                                 |
| --------- | --------------------------------------------- |
| Morning   | 06:00–11:59                                   |
| Afternoon | 12:00–16:59                                   |
| Evening   | 17:00–21:59                                   |
| Overnight | 22:00–05:59 (belongs to the day it starts on) |

Aggregate the hourly rows in each bucket:

| Field       | Aggregation                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Temp        | Max for Morning/Afternoon, value at bucket start for Evening, min for Overnight. Label "High"/"Low" when used as the day's extreme (see fixture) |
| RealFeel    | Same rule as Temp, using `RealFeelTemperature`                                                                                                   |
| Conditions  | Phrase of the hour with the highest precipitation probability; otherwise the most frequent `IconPhrase`                                          |
| Wind        | Max sustained speed; direction = the most frequent direction (`Wind.Direction.Localized`)                                                        |
| Gusts       | Max `WindGust.Speed`                                                                                                                             |
| Rain chance | Max `RainProbability` (fall back to `PrecipitationProbability`)                                                                                  |
| Rain amount | Sum of `Rain.Value`; append `(~N hrs)` when hours with rain > 0                                                                                  |

Daily fallback: Day → "{Dow} Day", Night → "{Dow} Overnight", using `LongPhrase`, `Wind`, `WindGust`, `RainProbability`, `Rain`, `HoursOfRain`.

**Range filtering:** the user picks a start and end (date plus period, e.g. "Fri Morning" → "Sun Night"). Include only the periods inside that range.

---

## 6. Wind Rules Engine (`packages/shared/wind.ts`)

Input: max sustained wind and max gust across the selected range.

**Tiers (by max gust):**

| Tier   | Gust mph | Beaufort label             | Summary phrase                                                            |
| ------ | -------- | -------------------------- | ------------------------------------------------------------------------- |
| Calm   | < 20     | ≤ moderate breeze          | "Light wind. No backyard prep needed."                                    |
| Breezy | 20–29    | fresh breeze               | "Light items may slide or flap."                                          |
| Windy  | 30–39    | strong breeze to near gale | "Moves anything light or loose, not damaging-storm level."                |
| Gale   | 40–54    | gale / strong gale         | "Damaging gusts possible. Secure everything loose; small limbs may fall." |
| Storm  | ≥ 55     | storm+                     | "Dangerous wind. Stay indoors; expect tree and property damage."          |

- **Windy** tier = the approved table in §2.2, **verbatim**.
- Calm tier: hide the backyard table and show the one line only.
- Breezy, Gale, and Storm: the agent drafts row text in the same format (same 6 items, same 4 columns), then **gets owner approval before release**. Put this text in `wind-rules.json` so it's editable without code changes.
- Summary line format: `**{Day1}:** {sustained} mph, gusts {gust}. **{Day2}:** gusts to {gust}. {Tier summary phrase}`
- Rule of thumb: `secure anything that catches air or weighs under ~20 lbs **before {first period with gusts ≥ 30}**, through {last such period}.` Omit it in the Calm tier.

---

## 7. Report Model (`packages/shared/report.ts`)

```ts
export type Period = {
  label: string; // "Fri Afternoon"
  start: string; // ISO, local
  temp: string; // "69° (68°)" | "Low 58° (51°)"
  conditions: string;
  windDir: string; // "NNE"
  wind: number; // mph
  gust: number; // mph
  rainChance: number | null; // %
  rainAmount: number; // inches
  rainHours?: number;
};

export type Alert = { name: string; start: string; end: string; area?: string };

export type Report = {
  location: { key: string; name: string; admin: string; country: string; tz: string };
  range: { start: string; end: string };
  story: string; // one line; from daily Headline.Text, trimmed
  periods: Period[];
  alerts: Alert[];
  sun: { rise: string; set: string }[]; // per day
  worstWindow: string; // label(s) with the highest rain chance × gust
  dataGaps: string[]; // omitted periods
  wind: {
    maxSustained: number;
    gustLow: number;
    gustHigh: number;
    tier: WindTier;
    summary: string;
    rows: BackyardRow[] | null;
    ruleOfThumb: string | null;
  };
  source: string; // "AccuWeather, {Location}, retrieved {date}."
  units: 'imperial' | 'metric';
};
```

`buildReport(rawDaily, rawHourly, rawAlerts, location, range)` is a **pure function** in `shared` and is fully unit-tested.

**Worst window:** the consecutive periods with the highest `rainChance/100 × gust`, formatted like "Sat evening–overnight (rain + wind)".

---

## 8. Server API (`apps/server`)

| Method | Route               | Request                               | Response                                                                         |
| ------ | ------------------- | ------------------------------------- | -------------------------------------------------------------------------------- |
| GET    | `/api/health`       | —                                     | `{ ok: true }`                                                                   |
| GET    | `/api/capabilities` | —                                     | `{ tier, maxDailyDays, maxHourlyHours, periodsMode: "4-period" \| "day-night" }` |
| GET    | `/api/locations?q=` | text or zip                           | `[{ key, name, admin, country }]` (max 10)                                       |
| POST   | `/api/report`       | `{ locationKey, start, end, units? }` | `Report`                                                                         |
| POST   | `/api/report/pdf`   | same body                             | `application/pdf`, filename `{City}_Weather_{MonDD}-{MonDD}.pdf`                 |

- Validate all input with `zod`. Reject ranges outside the forecast window with a `400` and a clear message ("Forecasts available through {date}.").
- **Cache (in-memory LRU):** locations 24h; daily 60 min; hourly 30 min; alerts 10 min. Key = endpoint + locationKey + params.
- Map AccuWeather errors: `401/403` → "API key invalid or plan doesn't include this data"; `503`/quota → "Daily API limit reached". Log without the key.
- Rate-limit `/api/*` (for example with `@fastify/rate-limit`, 60 requests/min per IP).
- CORS: allow only `WEB_ORIGIN`.

**PDF generation:** a `@react-pdf/renderer` document in `packages/shared/pdf/ReportPdf.tsx`, rendered with `renderToBuffer`. **Assert a single page:** if rendering overflows, step the table font down (7.8 → 7.3 → 6.8pt) and retry. If it still overflows, return `422` "Range too long for one page — shorten it." Never silently spill onto a second page.

---

## 9. Client (`apps/web`)

**One screen.**

| Area            | Behavior                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Location search | Autocomplete input (debounced 300ms) → `/api/locations`; also accepts a zip                                                         |
| Range picker    | Start: day + period; End: day + period. Days are limited to `maxDailyDays` from capabilities. Default: next Fri Morning → Sun Night |
| Units toggle    | °F/mph/in ↔ °C/km/h/mm                                                                                                              |
| Generate button | POST `/api/report` → renders the report preview                                                                                     |
| Report preview  | HTML version matching the PDF layout (same order, columns, and style tokens as §2.3)                                                |
| Download PDF    | POST `/api/report/pdf` → downloads the file                                                                                         |
| States          | Loading skeleton; error banner with the server message; empty state                                                                 |
| Plan notice     | If `periodsMode = day-night`, a small note: "Your API plan provides Day/Night only."                                                |

Mobile-responsive (the owner often works mobile). Tables scroll horizontally on small screens.

---

## 10. Config

`.env.example`

```
ACCUWEATHER_API_KEY=
ACCUWEATHER_AUTH_MODE=query        # query | bearer
ACCUWEATHER_TIER=free              # free | standard | prime | elite (maps to capabilities table)
PORT=8787
WEB_ORIGIN=http://localhost:5173
DEFAULT_UNITS=imperial
```

The tier → capabilities map lives in `apps/server/src/config/tiers.ts`. **Fill it from AccuWeather's current pricing page. Don't guess.**

---

## 11. Build Milestones

| #   | Milestone                                                         | Done when                         |
| --- | ----------------------------------------------------------------- | --------------------------------- |
| M1  | Monorepo scaffold, lint, tests, `pnpm dev` runs both apps         | Health route OK; web loads        |
| M2  | AccuWeather client + cache + location search                      | Search "Brooklyn" returns results |
| M3  | `shared`: period builder, wind engine, `buildReport` + unit tests | Fixture test passes (§12)         |
| M4  | `/api/report` + HTML preview                                      | Report renders for any location   |
| M5  | Server PDF, one-page guarantee                                    | PDF matches §2 layout; one page   |
| M6  | Error handling, rate limit, mobile polish, README                 | All acceptance criteria pass      |

---

## 12. Tests & Acceptance Criteria

**Golden fixture:** hand-build raw AccuWeather-shaped JSON that reproduces §2.1. `buildReport` must output those exact period rows, and the Windy-tier backyard table must match §2.2 **character-for-character**.

| #   | Acceptance criterion                                                                     |
| --- | ---------------------------------------------------------------------------------------- |
| 1   | Any location worldwide (text or zip) → report in < 3s (cached < 300ms)                   |
| 2   | Any range within the forecast window is accepted; ranges outside it → clear error        |
| 3   | PDF is always exactly **one page**, landscape Letter                                     |
| 4   | Column sets and order match §2.1 and §2.2 exactly (the backyard table has **4 columns**) |
| 5   | Missing periods are listed in the data-gaps note; nothing is invented                    |
| 6   | Alerts, sunrise/sunset, and worst window appear when data exists                         |
| 7   | API key never reaches the browser (check the network tab and bundle)                     |
| 8   | Works on mobile Safari/Chrome                                                            |
| 9   | `pnpm test` is green; one Playwright smoke test: search → generate → download            |

---

## 13. README must include

Setup (`pnpm i`, `.env`), how to get an AccuWeather key, tier limits, `pnpm dev`, `pnpm build && pnpm start`, and deployment notes (single Node service serving the built web app from Fastify static, deployable to Render or similar).

---

## 14. Open Questions for the Owner (ask before M6)

1. Which AccuWeather plan will you buy? (It determines 4-period vs Day/Night and the range length.)
2. Approve the backyard wording for the Breezy, Gale, and Storm tiers (the agent drafts it).
3. Keep the Sukkah row year-round, or show it only during Sukkot?
4. Hosting target (Render? Techonsoft server?) and domain.

---

## 15. Decisions Made With the Owner (conversation log)

Every decision below was made in the planning conversation. The reason is included where one was discussed.

| #   | Decision                                                                                                                       | Reason (as discussed)                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Report covers a user-chosen range (the original ask was **Fri morning → Sun night**)                                           | Owner's request: detailed weather across a multi-day window                                                                                                                                                                        |
| 2   | Day-by-day breakdown by period with temp (RealFeel), conditions, wind/gusts, rain chance, rain amount                          | Owner asked for "detailed weather info"; this is the format he reviewed and approved                                                                                                                                               |
| 3   | Include alerts (coastal flood, rip current), sunrise/sunset, worst window                                                      | Part of the approved report                                                                                                                                                                                                        |
| 4   | Include the **backyard wind section**, explaining what the wind does to specific items                                         | Owner asked what the wind strength would do to things in his backyard                                                                                                                                                              |
| 5   | Backyard items include a **Sukkah** row                                                                                        | Relevant to the owner's use (forecast window fell during Sukkot)                                                                                                                                                                   |
| 6   | **Gusts drive the risk**, not sustained wind; the rule of thumb is to secure anything that catches air or weighs under ~20 lbs | Gusts do the damage; stated in the approved content                                                                                                                                                                                |
| 7   | Output as a **PDF**                                                                                                            | Owner requested it                                                                                                                                                                                                                 |
| 8   | PDF is **exactly one page** and contains **both** the day-by-day breakdown and the winds section                               | Owner requested: "One page. Include the day by day breakdown. And the winds section"                                                                                                                                               |
| 9   | Backyard chart **shortened** (items grouped into 6 rows, shorter text)                                                         | Owner requested: "Shorten the chart backyard items"                                                                                                                                                                                |
| 10  | Backyard chart keeps **all 4 columns**, including "At 20 mph (sustained)"                                                      | The column was removed without being asked; the owner rejected that. Restored                                                                                                                                                      |
| 11  | **Standing rule:** never change anything the owner already saw and approved unless he asks                                     | Owner's explicit instruction after the unrequested column removal                                                                                                                                                                  |
| 12  | Report must work for **any area** and **any day**                                                                              | Owner asked whether it could be built for any day and any area, not only from uploaded files                                                                                                                                       |
| 13  | Date range limited to the forecast window (~7–10 days max; longer depends on the API plan)                                     | Forecasts beyond that aren't reliable                                                                                                                                                                                              |
| 14  | Data source: **AccuWeather API** (not page scraping, not manual uploads)                                                       | Owner wants the full AccuWeather detail. Scraping pages is unreliable (script-loaded content, blocks automated access). Manual upload works but requires downloading pages each time. The API delivers the full data automatically |
| 15  | Build it as an **app**: **React** client + **Node.js** server, **TypeScript** on both                                          | Owner's choice of stack                                                                                                                                                                                                            |
| 16  | **No database** for now                                                                                                        | Owner's choice: not needed for v1                                                                                                                                                                                                  |
| 17  | API key stays **server-side**                                                                                                  | An API key requires a server to hold it securely; the owner supplies his own AccuWeather key                                                                                                                                       |
| 18  | API plan affects detail level (4 periods vs Day/Night) and range; the owner must check current AccuWeather pricing             | Free/trial tiers have tight limits; noted when the API option was discussed                                                                                                                                                        |
| 19  | Deliverable is a **full handoff** so the next agent can build it                                                               | Owner's request                                                                                                                                                                                                                    |

**Fallback noted in discussion:** uploading AccuWeather pages (as the owner did for the first report) gives the most exact period detail with zero setup. It is not part of v1, but future versions could keep it as an import option if the API plan is limited.
