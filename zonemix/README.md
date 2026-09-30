# ZoneMix

Automatic per-area sound for live events. Each area of a venue (dance floor, dining, bar, foyer) gets its own mix from the digital mixer. A small sensor in each area measures what guests actually hear, and ZoneMix keeps every area at its target level, following the per-scene settings you give it:
- the level of each mic and instrument group per area;
- crowd-noise compensation;
- speech ducking;
- loudness limits.

**Status:** design plus a tested control engine, running against a simulated venue. Not yet tested on real hardware. There is no user interface yet (Phase 1).

| Read | For |
|---|---|
| [docs/DESIGN.md](docs/DESIGN.md) | How the whole system works |
| [docs/HARDWARE.md](docs/HARDWARE.md) | What to buy, with prices; sensor build |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Build phases |
| [docs/ALTERNATIVES.md](docs/ALTERNATIVES.md) | Ready-made products and how close they come |
| [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) | Decisions, what's verified, next steps |
| [docs/OPEN_ITEMS.md](docs/OPEN_ITEMS.md) | Questions for you and the to-do list |

## Run it

Needs Node.js 22 or newer. There are no dependencies to install.

```sh
cd zonemix
npm test            # 52 tests
npm run simulate    # a simulated wedding evening in the example venue
```

`npm run simulate -- path/to/venue.json --seed 2` runs your own venue file with a different random seed. [config/example-venue.json](config/example-venue.json) is a complete example with 5 zones and 4 scenes.

## Layout

```
config/example-venue.json   example venue: zones, channels, scenes, calibration
src/engine/                 the control engine (pure computation, no I/O)
src/mixer/                  OSC and the Behringer X32/M32 + X Air driver
src/sensors/                sensor UDP receiver
src/sim/                    venue simulator and scenarios
test/                       tests (node --test)
docs/                       design, hardware, roadmap, decisions, research
```
