# Operations

## Live deployment

|                |                                                           |
| -------------- | --------------------------------------------------------- |
| URL            | **https://windwise-h6a1.onrender.com**                    |
| Render service | `windwise` (`srv-daqmvj6gekts73990us0`)                   |
| Workspace      | Mayer (`tea-d97ieknaqgkc73ejas5g`)                        |
| Dashboard      | https://dashboard.render.com/web/srv-daqmvj6gekts73990us0 |
| Region / plan  | Virginia · **free**                                       |
| Runtime        | Docker, built from `./Dockerfile`                         |
| Deploy branch  | `claude/magical-knuth-ufkstw` — see "Branches" below      |
| Auto-deploy    | on commit                                                 |

The free Render plan **sleeps after 15 minutes idle**, so the first request after a nap takes about a
minute. That misses acceptance criterion 1 (a report in under 3s). Moving to Render's Starter plan
fixes it; nothing in the code needs to change.

## Environment variables

Set these in the Render dashboard → the service → **Environment**. `render.yaml` carries the
non-secret ones; `ACCUWEATHER_API_KEY` is `sync: false` and must never be committed.

| Variable                | Live value                           | Notes                                                          |
| ----------------------- | ------------------------------------ | -------------------------------------------------------------- |
| `ACCUWEATHER_API_KEY`   | _(set in Render only)_               | **Secret.** Never in git, never in a PR body, never in chat    |
| `ACCUWEATHER_AUTH_MODE` | `bearer`                             | `zpka_…` portal keys use Bearer; older keys use `query` (D-32) |
| `ACCUWEATHER_TIER`      | `free`                               | See "Choosing the tier" below                                  |
| `WEB_ORIGIN`            | `https://windwise-h6a1.onrender.com` | The only origin CORS allows                                    |
| `DEFAULT_UNITS`         | `imperial`                           | `imperial` or `metric`                                         |
| `PORT`                  | set by Render                        | Defaults to 8787 locally                                       |

### Choosing the tier

`ACCUWEATHER_TIER` tells the server how much to ask AccuWeather for. Under-asking wastes the plan;
over-asking used to break reports, and since D-22 it merely costs a wasted call or two before the
daily request steps down to a window the key allows.

| Value      | Daily   | Hourly | Alerts | Report rows                               |
| ---------- | ------- | ------ | ------ | ----------------------------------------- |
| `free`     | 5 days  | 12 h   | no     | Day / Night                               |
| `trial`    | 15 days | 120 h  | yes    | Morning / Afternoon / Evening / Overnight |
| `starter`  | 5 days  | 12 h   | no     | Day / Night                               |
| `standard` | 5 days  | 12 h   | no     | Day / Night                               |
| `prime`    | 10 days | 72 h   | yes    | Morning / Afternoon / Evening / Overnight |
| `elite`    | 15 days | 120 h  | yes    | Morning / Afternoon / Evening / Overnight |

**The account is on the 14-day free trial** (started Sep 24, 2026, expires **Oct 8, 2026**), which
AccuWeather's portal describes as full **Elite**-level Core Weather at 500 calls/day (D-21). The owner
confirmed he activated it, so the live service runs `ACCUWEATHER_TIER=trial` and produces the
Morning / Afternoon / Evening / Overnight rows and alerts the trial pays for (D-33).

**On Oct 8, 2026 the trial expires.** Set `ACCUWEATHER_TIER` to whatever plan was bought, or back to
`free`. Nothing breaks if this is forgotten (D-22 handles it), but reports will quietly cost extra
calls and lose the 4-period rows.

One report costs up to **4 calls** (location, daily, hourly, alerts); repeats inside the TTLs are
free. At 500 calls/day the trial is roughly 125 cold reports a day.

## Rotating the key

1. Create a new key in the AccuWeather developer portal.
2. Update `ACCUWEATHER_API_KEY` in Render → Environment. Saving triggers a redeploy automatically.
3. Confirm with `GET /api/capabilities` (always 200) and then a real search, which exercises the key.
4. Delete the old key in the portal.

If a key is ever committed or pasted somewhere public, rotate it first and clean up second.

## Verifying a deploy

```bash
curl -s https://windwise-h6a1.onrender.com/api/health          # {"ok":true}
curl -s https://windwise-h6a1.onrender.com/api/capabilities    # tier + limits
curl -s 'https://windwise-h6a1.onrender.com/api/locations?q=11219'
```

A `503 "AccuWeather API key is not configured on the server."` from `/api/locations` means the key
env var is missing or blank. `/api/health` and `/api/capabilities` answer without a key, so a green
health check alone does **not** prove the key works.

> **Sandbox note for agents:** this session's egress policy blocks both `dataservice.accuweather.com`
> and `onrender.com`. Neither the live app nor the AccuWeather API can be reached from the agent
> container — a `CONNECT tunnel failed, response 403`. Verify through Render's own logs
> (`list_logs`) instead, and say plainly when something could not be checked live.

## Local development

```bash
pnpm i
cp .env.example .env     # add ACCUWEATHER_API_KEY
pnpm dev                 # API :8787, web :5173 with /api proxied
```

Production shape, one process:

```bash
pnpm build && pnpm start
```

Requires Node ≥22.12 and pnpm 10. The e2e test needs a Chromium once:
`pnpm --filter @windwise/web exec playwright install chromium`, or point
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` at an existing one.

## Branches

| Branch                        | Role                                                                |
| ----------------------------- | ------------------------------------------------------------------- |
| `main`                        | An **unrelated project.** WindWise shares no history with it (D-26) |
| `claude/magical-knuth-ufkstw` | The branch Render currently deploys from                            |
| `claude/nifty-knuth-kpswag`   | This session's branch, based on the above                           |

Because the WindWise branches share no ancestry with `main`, git refuses to merge them by default —
the separation is mechanical, not just a convention. **Whichever branch Render points at is the one
that ships**; a change that only lands elsewhere is not deployed, however green its tests are.
