# ZoneMix: project context

**Read this first.** It is the single source of truth for any agent or resumed session.

## Goal

A digital event sound system that automatically adjusts the mix in each area (zone) of a venue:
- from sensors that measure what guests hear;
- following per-zone, per-scene settings: level targets, per-mic/instrument mix, limits, crowd-noise compensation, speech ducking.

The user asked for advice on designing and building the entire setup, hardware and software.

## User's working rules

From the "New Project Handoff" PDF.

**Isolation**
- Everything lives in `zonemix/` on the session branch, created from `origin/main`.
- Never touch other projects or branches. No merge into `main`, and no pull request unless asked.
- Nothing is shared with other folders.
- Secrets go only in the host's environment settings.
- Relative paths only, so the folder can move to its own repo unchanged.

**Documentation**
- Keep this file and `OPEN_ITEMS.md` current in the same commit as any change.
- Log every user message word for word in `history/CONVERSATION_LOG.md`.
- Put verified facts with sources in `history/RESEARCH_NOTES.md`.

**How the user likes to work**
- Don't ask what can be worked out. Ask only questions that change the outcome, numbered P1, P2 …, saying what each answer changes.
- As automatic as possible: one-line installs, self-checks that explain problems in plain English, no manual dashboard steps.
- Quality over convenience. Off-the-shelf is a plus, never at the cost of the result.
- Finish, test, then report. Run the full test suite before every push. Try UIs at phone size in a real browser. Confirm deploys are live.
- Be honest about what was and wasn't verified.

**Replies and preferences**
- Plain English, outcome first, short tables.
- Exact products, quantities, prices and totals before any purchase.
- The user uses Android and prefers web apps: mobile-first, installable.
- Fold in mid-task messages and confirm they were handled.

**Deploys and commits**
- Render (free plan) for anything hosted. Free services sleep and lose their disk on restart.
- No model names in commits, code or docs.

## Environment and constraints

- Repo `mayerspitz/test` (temporary home), branch `claude/peaceful-mendel-n2c532`.
- Sandbox with Node 22. No audio hardware, no mixer, no internet access to most vendor sites.
- Real events usually have no dependable internet, so the controller must run on site.

## Requirements

1. Zones (areas with their own speakers), each fed from its own mixer bus.
2. Per zone, per scene: level target, or a fixed level for manual/limit-only zones; per-group mix levels with per-channel trims.
3. Sensors measure what guests hear; the controller adjusts zones automatically.
4. Limits: 1-second maximum; 15/60-minute Leq budgets.
5. Crowd-noise compensation; speech ducking.
6. Operation from a phone.

## Decision log

| # | Date | Decision | Why | Rejected |
|---|---|---|---|---|
| D1 | 2026-09-30 | Build in `zonemix/` on the session branch, following "New Project Handoff" | This session's repo is `mayerspitz/test`, which is what that document covers | The other PDF's orphan branch in `mayerspitz/tailored-travel-planning` (a different repo). Confirming with the user (P7). |
| D2 | 2026-09-30 | Working name "ZoneMix" | Descriptive; no name was given | — |
| D3 | 2026-09-30 | Control sensors in the listening areas, not on the speakers | A sensor on a speaker measures the speaker, not what guests hear; it misses crowd noise and spill | Speaker-mounted sensors (kept only as an optional health check) |
| D4 | 2026-09-30 | Controller uses the mixer's meters plus a calibrated room model | Without knowing what is sent, a louder crowd turns music down and zones fight | Pure feedback on sensor level |
| D5 | 2026-09-30 | v1 controls levels (dB(A)); per-source measurement and auto-EQ deferred to Phase 4 | One room mic cannot separate sources without audio streaming and correlation | Spectral control in v1 |
| D6 | 2026-09-30 | First mixers: Behringer X32/M32 and X Air (OSC) | Open, documented protocol; affordable; common | Starting with WING, A&H or Yamaha (later drivers) |
| D7 | 2026-09-30 | Node.js 22, no dependencies; engine is pure and deterministic; the simulator drives the same code | One-command install; one language for controller and web app; testable | Python (equally viable) |
| D8 | 2026-09-30 | Controller runs on site; cloud only for demos and reports | Venues lack dependable internet | Cloud control |
| D9 | 2026-09-30 | A zone's target means the level of its main content: the loudest group in its mix, or the sum of playing groups if higher | Stops quiet background music being pushed up when it plays alone, and stops idle mics biasing gains (the simulator showed a 1.5 dB bias before this) | Summing all channels at nominal level |
| D10 | 2026-09-30 | Noise estimate updates only when the fit pins it down (gap-style) | Noise far under the program is unmeasurable; updating anyway made it collapse by 15 dB in simulation | Always updating |
| D11 | 2026-09-30 | Safety limiter stops cutting once the zone's own speakers are 10 dB under spill; the alarm names the neighbour | Cutting a zone that isn't the source only makes it worse there | Cutting to silence |
| D12 | 2026-09-30 | Sensor protocol: JSON over UDP broadcast to port 7700 | Zero configuration on one network; losing a packet is harmless | MQTT (needs a broker), per-sensor configuration |
| D13 | 2026-09-30 | Recommend PoE sensors (ESP32-POE-ISO + ICS-43434), with Wi-Fi as a fallback | Event Wi-Fi at 2.4 GHz is crowded by guests' phones | Wi-Fi only |

## What's built and where it runs

- `src/engine/`:
  - `config.js`: loader and checks;
  - `solver.js`: spill-aware gains;
  - `estimator.js`: drift and noise;
  - `leq.js`: Leq budget;
  - `engine.js`: control loop, limiter, ducking, scenes, alarms;
  - `calibration.js`;
  - `geometry.js`: delays.
- `src/mixer/`: OSC codec; Behringer X32/X Air driver (faders, sends, keep-alive, X32 meter decode).
- `src/sensors/gateway.js`: sensor UDP receiver.
- `src/sim/`: venue simulator, wedding-evening scenario, `npm run simulate`.
- `test/`: 52 tests, `npm test`.
- **Nothing is deployed.** There is no UI yet. The environment variable names are in `.env.example`.

## Verified vs not yet verified

- **Verified in simulation and tests.** Across 3 seeds:
  - auto zones hold their target to 0.4–0.6 dB mean error, 90% of the time within 1.1 dB;
  - no zone exceeds its 1 s limit;
  - the dance floor's worst 15-min Leq is 95.6–97.4 dB against a 100 dB limit;
  - drift is learned to within 0.1 dB, noise to about ±3 dB;
  - all alarms behave as designed.
  - The OSC encoding and the driver were checked against a simulated mixer over real UDP.
- **Not verified.**
  - Any real mixer: the addresses and fader law come from the protocol document, not tested on hardware.
  - Whether X32 channel meters are pre- or post-fader; the X Air meter format.
  - Real sensors and rooms.
  - Most prices, and the ready-made products' details (search snippets only).

## Next steps

1. Get answers to P1–P8 (`OPEN_ITEMS.md`).
2. Phase 1 (`ROADMAP.md`): controller service, web app with advisory mode, calibration wizard, simulator demo online, then a bench test on the user's mixer.
