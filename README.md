# Shivtei Yisroel — Loans CRM

Back-office CRM for **Gemach Shivtei Yisroel**: members, children & units (membership savings),
borrowers & loans, co-borrowers, potential-member pipeline, payments, and a fully
configurable settings system.

Built from the original Moqups BA designs (see `docs/mockups/` for all 50 screens and
`docs/SPECS.md` for the extracted functional spec). Open clarification items are tracked in
`docs/QUESTIONS.md` — **review before building further features**.

## Stack

- **Next.js 14** (App Router, server actions) + Tailwind CSS + lucide-react icons
- **Prisma** ORM → **Postgres** (Neon, Render Postgres, or any Postgres)
- **Render** web service (see `render.yaml`)
- **Google sign-in** (staff-only: the Google account's email must exist in Users) with
  email+password fallback; HMAC cookie sessions

## Local development

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL (Neon) + SESSION_SECRET
npx prisma db push          # create schema
npm run db:seed             # seed config, roles, admin user, demo data
npm run dev
```

Login with the seeded admin: `admin@shivteiyisroel.org` / `ChangeMe!2026`
(change this immediately in Settings → Users).

## Deploy (Render + Neon)

1. Create a **Neon** project (or a Render Postgres) → copy the connection string.
2. In **Render**: New → Blueprint → point at this repo (`render.yaml` is picked up),
   or create a Web Service manually with build `npm ci && npm run build` and start
   `npx prisma db push && npx tsx prisma/seed.ts && npm run start`.
3. Set env vars: `DATABASE_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, `APP_URL` (your Render URL).
4. **Google OAuth setup**: Google Cloud Console → APIs & Services → Credentials →
   Create OAuth client ID (Web application) → add Authorized redirect URI
   `https://<your-app>/api/auth/google/callback`. Only Google accounts whose email
   exists in Settings → Users can sign in (add users with an empty password for
   Google-only access).
5. First boot pushes the schema and seeds defaults; `/api/health` is the health check.

## Configuration philosophy

**Every business variable is data, not code** — stored in the `ConfigItem` table and editable
under **Settings → Configuration**, organized by group:

- Units & Membership (e.g. `units.maxPerChild` = **6**, membership fee $25 / every 2 years)
- Fees (CC/ACH processing 3%, cancelled-unit $35, dispute $35)
- Returned Payments (retry period/tries and fee rules per CC/ACH)
- Plan Defaults (membership $1250/50mo/$25, loan $10,000/60mo/$150, credit $600 last 4 mo)
- Payments & Schedules (system schedule day = 5th, upcoming window 30 days)
- Lists & Labels (member labels, history categories, phone labels, alert types)

Code reads values via `getConfig(key, fallback)` — never hardcode a business number.

## Repository layout

```
prisma/schema.prisma   # full domain model
prisma/seed.ts         # config catalog + roles + admin + demo family (mirrors mockups)
src/app/(app)/         # authenticated app: dashboard, members, children, borrowers,
                       # co-borrowers, potential-members, payments, settings, search
src/lib/               # db client, auth, config helpers
docs/SPECS.md          # extracted functional spec (all 50 mockup pages)
docs/QUESTIONS.md      # open clarification questions — answer before deep build-out
docs/mockups/          # PNG of every Moqups page
```

## Status

This is the **initial scaffold**: schema, auth, seeded demo data, list/detail screens for all
core entities, payments views, and the working Configuration page. Write flows beyond
member/potential/user creation (payments processing, unit/loan issuance, document upload)
are intentionally deferred until the clarification round — see `docs/QUESTIONS.md`.
