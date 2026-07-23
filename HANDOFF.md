# HANDOFF — Shivtei Yisroel Loans CRM

**Read this first.** This file gives a new Claude session (or developer) the complete context
of the project so far: what this is, every decision made with its reasoning, what is built and
verified, what is pending, and the agreed path forward. The owner is **Mayer Spitz**
(mspitz@techonsoft.com), GitHub **mayerspitz**.

---

## 1. What this project is

A back-office **Loans CRM for Gemach Shivtei Yisroel** (an interest-free loan fund).
Members enroll their children in membership savings "units"; when a child reaches marriage
age the units are "exercised" into interest-free loans; co-borrowers guarantee/pay on loans;
staff manage the whole lifecycle including payments, schedules, and a lead pipeline.

The requirements source is a **Moqups BA design from ~2021** (50 pages) that Mayer uploaded
as a zip. All 50 pages were rendered and are in **`docs/mockups/`** (PNG per page, plus
`_all_pages_text.txt` with every text element extracted from the Moqups JSON). The extracted
functional spec is **`docs/SPECS.md`**. Mayer says the mockups are partly outdated — many
things will change in clarification rounds.

### Domain model / ID scheme (from mockups)
- **Member** `125` → **Child** `125A` → **Unit** `125A1` (savings slot, max per child is
  configurable — now **6**, was 4 in mockups)
- **Borrower** `B125A` (usually a child who exercised units) → **Loan** `B125A1` (one per unit)
- **Co-Borrower** `CB12` — pays/guarantees on borrowers' loans
- **Potential Member** — caller-ID based lead with call/follow-up scheduler

Mockup-era numbers (all now config/seed values, likely outdated): unit membership $1,200–1,250
over 50 months ($25–35/mo), loan $10,000 over 60 months ($150/mo), potential credit $600
covering last 4 months, membership fee $25 every 2 years, CC/ACH processing 3%,
cancelled-unit/dispute fees $35, returned-payment fee $25 (CC: 3 retries/2 days; ACH: none).

---

## 2. Decisions made (with reasoning)

| Decision | Reasoning |
|---|---|
| Duplicate mockup pages: "- New"/"Updated" variants are current; hidden pages are old drafts | Mayer confirmed multiple BA revisions exist; hidden pages + trash (23 deleted pages) are stale. Pairs listed in SPECS §intro and QUESTIONS §C16 |
| **Config-first architecture**: every business variable in a `ConfigItem` DB table, editable at Settings → Configuration, grouped; code reads via `getConfig()` | Mayer: "anything that could be subject as a variable, please make a detailed organized config page". Max units already changed 4→6; more will change |
| **Max units per child = 6** | Explicit instruction from Mayer (was 4 in mockups) |
| Stack: **Next.js 14 App Router + Prisma + Tailwind**, single web service | One deployable unit on Render; server actions cover CRUD without separate API tier |
| **Prisma pinned to 5.22.0** | Prisma 7 broke `url = env(...)` in schema (requires prisma.config.ts + adapters). Do NOT upgrade casually |
| **Postgres** (Neon or Render Postgres — any Postgres) | Mayer chose Postgres; Neon was the initial host idea; schema is provider-agnostic via `DATABASE_URL` |
| **Google sign-in** as primary auth, hand-rolled server-side OAuth code flow (`/api/auth/google` → `/api/auth/google/callback`) | Mayer: "For auth, make Google sign in". Hand-rolled = no NextAuth dependency, full control. **Staff-only rule: Google account is accepted only if its email exists in the `User` table** |
| Email+password kept as fallback; `passwordHash` nullable (Google-only users) | Prevents lockout before Google creds configured; seeded admin needs first entry |
| Sessions: HMAC-signed cookie (`sy_session`), `SESSION_SECRET` env | Lightweight, no session store needed |
| **lucide-react icons everywhere, zero emojis**; refreshed header (logo mark, icon search, avatar chip, icon logout) and sidebar (gradient, active-route indicator) | Mayer: "I don't like emojis please change to modern icons everywhere", "enhance the UI of the menu and header" |
| Render service name **`shivteiyisroel`** | Must match the OAuth origin Mayer registered in Google Console: `https://shivteiyisroel.onrender.com` |
| Demo seed mirrors mockup family (member 125 Moshe Rosen, children A–D, borrower B125A, co-borrower CB12) | Makes every screen look like the mockups for review |
| Deep write-flows deferred until clarification round | Mayer's explicit process: first a running initial app, then go feature-by-feature with questions (see §5) |

---

## 3. What is built and verified

**Repo layout**: see README.md. App code in `src/app/(app)/…`, schema `prisma/schema.prisma`,
seed (config catalog + demo data) `prisma/seed.ts`, deploy `render.yaml`.

Implemented and **tested** (production build clean; all pages returned 200 with correct
seeded content against a local Postgres; Google auth redirect verified to hit
`accounts.google.com` with correct params; screenshots in `docs/app-screenshots/`):

- Login (Google button + email/password fallback), middleware route guard
- Dashboard: Action Needed (overdue units/loans, declined transactions) + Follow-Ups panel
- Members: list (+search, action-needed badges), create, detail (children, children loans,
  payments summary, notes, history, old info, documents), payments page (schedules incl.
  system/default chips, methods, transaction history with status chips, credit accounts)
- Children list (per-unit aggregation + totals), Borrowers list/detail (units table,
  co-borrowers, "Exercise Units" empty state), Co-Borrowers list/detail,
  Potential Members (Active/Cancelled tabs, create, detail with calls/follow-ups
  RESCHEDULED/CANCELED history), global Search (grouped results)
- Settings: **Configuration page** (all variables editable, 6 groups — the heart of the
  config-first decision), Plans (toggle active; edit/delete-only-when-no-units rule noted),
  Users (list + add; password optional), Roles & Permissions (read-only display)
- `/api/health` for Render health checks

**Seeded logins**: `admin@shivteiyisroel.org` / `ChangeMe!2026` (change immediately).

**Not yet built** (deliberately deferred): payment processing/gateway, schedule execution
engine, unit/loan issuance ("Exercise Units" action), allocation of payments across
children/units, document upload storage, most edit flows, plan create/edit forms, role
editing, potential→member conversion, reports, notifications, config audit trail.

---

## 4. Deployment state & credentials status

- **Target repo**: `mayerspitz/ShivteiYisroel` — was NOT reachable from the original session
  (session repo-scope was locked to `mayerspitz/test`; that's why this branch lives on `test`).
  Mayer will create the new repo from this branch and open a new session against it.
- **Render**: Mayer will create the service manually or via `render.yaml` (Blueprint).
  Render's GitHub App needs repo access granted (GitHub → Settings → Applications →
  Render → Configure). Service name must stay `shivteiyisroel` (OAuth origin match).
- **Neon/Postgres**: not yet created. Env: `DATABASE_URL`.
- **Google OAuth**: Mayer created a Web-application OAuth client named "ShivteiYisroel" with
  JS origin `https://shivteiyisroel.onrender.com`. **Pending**: (a) add Authorized redirect
  URI `https://shivteiyisroel.onrender.com/api/auth/google/callback`; (b) he only obtained the
  **Client ID — no secret yet**; instructed to open the client in Google Console → Client
  secrets → **Add/Reset secret** (new console shows secrets only once at creation).
  Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL=https://shivteiyisroel.onrender.com`.
- First boot on Render runs `prisma db push` + seed automatically (see `render.yaml`).

---

## 5. The agreed process & pending path (IMPORTANT — this is the contract with Mayer)

Mayer's instructions, verbatim in spirit:

1. ✅ *"first I wanna see a first initial app up and running"* — done (this codebase).
2. ▶ **Next**: *"go through component by component and feature by feature, make sure you
   understand what everything is, and exactly the purpose and intended logic / math for the
   feature, all options the user should have and exactly how it should work"* — i.e. a
   structured clarification + spec-hardening round using **`docs/QUESTIONS.md`** (30 open
   questions, organized A–F: business fundamentals, payments engine, entities/screens,
   access/roles, proposed extras, suspected mockup errors).
3. When screens/features are ambiguous or two mockups conflict: **show Mayer the relevant
   screenshot** (from `docs/mockups/`) and ask — he explicitly requested screenshot-driven
   clarification.
4. *"if you think anything is wrong or have advice on improving or adding options, let me
   know and please clarify it with me"* — proactively flag issues/improvements (some already
   proposed in QUESTIONS §E: reports, receipts/reminders, config audit trail, data migration).
5. Keep the config page exhaustive — any new variable discovered goes into `ConfigItem` + seed.

### Suggested immediate next steps for the new session
1. Push this branch's content as `main` to the new repo; verify Render deploy goes green
   (`/api/health`), Google sign-in works end-to-end after secret + redirect URI are set.
2. Change the seeded admin password / add Mayer's real Google email as an Admin user.
3. Start the clarification round: walk `docs/QUESTIONS.md` with Mayer (batch by section,
   attach mockup screenshots), update `docs/SPECS.md` with answers, adjust config seed values
   to 2026 reality (mockup numbers are 2021-era).
4. Then build, in this order (pending answers): unit/loan issuance ("Exercise Units"),
   payments engine (schedules → transactions → allocation → overdue), edit flows,
   documents upload, potential→member conversion, reports.

---

## 6. Practical notes for the next session

- **Local dev/test**: `npx prisma db push && npx tsx prisma/seed.ts`, then `npm run dev`.
  The original session tested with local Postgres (`service postgresql start`,
  user postgres/postgres) and a Node script fetching every route with a forged HMAC session
  cookie — cheap and effective; replicate as needed.
- **Middleware** excludes `_next/*`, `favicon.ico`, `/api/health`, `/api/auth` from the auth
  guard — keep new public routes in that list.
- **Money**: stored as Prisma `Decimal(12,2)`; mockups display whole dollars.
- **Hebrew fields** render with `dir="rtl"`.
- The Moqups source zip parse pipeline (if ever needed again): `assets/data.js` holds
  `var MQ_Data = {...}` — strip prefix, parse JSON; pages under `pages[_order]`; offline
  viewer navigates with `#p=<pageId>` but only reads the hash on initial mount (full reload
  per page when screenshotting).
- Commit convention so far: descriptive messages, Co-Authored-By Claude trailer.
- `docs/app-screenshots/` shows the current app state (login, dashboard, member detail,
  member payments, borrower detail, potential detail, config, plans).

## 7. Conversation log highlights (chronological)

1. Mayer uploaded the Moqups zip; all 50 pages were rendered/reviewed; understanding was
   confirmed with a full inventory and the duplicate-pairs table.
2. Mayer: content is partly outdated; clarify before building final screens; max units 4→6;
   wants config page for all variables; wants full detailed specs; questions kept for later;
   **first an initial running app**; hosting Render, DB Neon, repo GitHub.
3. Repo switching saga: did not want `mayerspitz/test`; chose existing repo
   `mayerspitz/ShivteiYisroel`; session scope blocked access (403) despite attempts;
   work backed up to `test` branch `claude/moqups-design-review-lmatf2`; finally Mayer chose:
   push a clean branch to `test`, he creates the new repo from it + a new session (this file).
4. Auth/UI round: Google sign-in (implemented), Postgres confirmed, emojis→lucide icons,
   header/menu enhanced (implemented, screenshotted).
5. Render/Google setup guidance given (see §4 — redirect URI + client secret still pending
   on Mayer's side).
