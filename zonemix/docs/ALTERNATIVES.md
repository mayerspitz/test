# Is there something ready-made?

Checked on 30 September 2026. The sandbox could not open most manufacturer sites, so most points below come from search results of those pages. Sources are in [history/RESEARCH_NOTES.md](history/RESEARCH_NOTES.md).

## Short answer

**No product found does the whole thing:** sensors in each area automatically managing per-zone live mixes, per mic and instrument, at events. The pieces exist separately:

| What you want | Exists ready-made? | Where |
|---|---|---|
| A sensor per area raises or lowers that area's level with crowd noise | **Yes**, for fixed installations | Q-SYS, Biamp Tesira, BSS Soundweb London, Symetrix, AtlasIED Atmosphere, Yamaha MRX7-D, Bose ControlSpace |
| Different mix of mics/instruments per area | **Yes, manually** | Any digital mixer: one bus per area, recalled with scenes |
| Mics sharing gain automatically (only open mics are loud) | **Yes** | Dugan-style automixers built into X32 (channels 1–8), WING, Yamaha CL/QL/TF/DM3, Allen & Heath SQ/dLive |
| Shows SPL and legal limits to the engineer | **Yes**, display only | 10EaZy, Smaart |
| Cuts the whole system when too loud | **Yes**, single zone | Venue noise limiters (e.g. Formula Sound Sentry) |
| Hold each area at a target level, set all areas together allowing for sound spilling between them, keep within 15/60-min limits, per-scene targets, phone control, cheap wireless or PoE sensors | **Not found** | This is what ZoneMix adds |

## The closest ready-made setup (no custom software)

Put a fixed-install processor with ambient noise compensation (ANC) between your mixer's zone buses and the amplifiers:

```
mixer (one bus per zone, scenes for the per-zone mixes) → processor with ANC per zone → amps/speakers
                                                            ▲ one sense mic per zone
```

| Processor | ANC per zone | Approx. price | Notes |
|---|---|---|---|
| AtlasIED Atmosphere AZM8 + X-ANS sensors | Yes, 8 zones, network noise sensors | about $2,300 + sensors | Simplest to set up of this group; made for bars and restaurants |
| QSC Q-SYS Core 8 Flex (or Core Nano) | Yes (Ambient Compensator; any mic input) | about $1,800 (Nano about $2,190) | Most flexible. Lua scripting on the Core and an external control API, so custom logic can run on it later |
| Biamp TesiraFORTÉ AI | Yes (ANC blocks) | about $2,990 | Integrator-oriented |
| BSS Soundweb London BLU-100 | Yes (gap and non-gap ANC) | about $3,600 | Integrator-oriented |
| Symetrix Radius NX 12x8 | Yes ("SPL Computer") | about $4,200–4,800 | Integrator-oriented |

**What it would give you**
- Each area rises and falls with its crowd noise.
- Per-zone limiters.
- Per-mic/instrument mixes per area, switched by your mixer scenes.

**What it would not**
- A target level per area. ANC rides noise; it does not hold "dining at 72 dB(A)".
- Awareness of sound spilling between areas. Each zone's compensator works alone, and they can fight.
- 15/60-minute limit budgets and compliance logs.
- A per-event scene workflow tying the mixer scene to the zone behaviour.
- Speech ducking per area, unless programmed.

**The catch:** these are fixed-install products, designed for one building. They are programmed in desktop software by an installer, and re-tuning them for each event and venue is slow.

## Recommendation

- **For your own events soon, with the budget:** the ready-made route works today and covers maybe two-thirds of what you described. Q-SYS is the one to pick, because ZoneMix's logic can later run on it or drive it.
- **For the full behaviour, lower hardware cost, portability between venues, or a product to sell:** build ZoneMix. The core already works in simulation. The first real test (Phase 1) needs about $280 of extra hardware if you already own an X32/M32 or X Air and a laptop.
