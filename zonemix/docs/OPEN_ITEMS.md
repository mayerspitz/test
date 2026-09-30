# Open items

Questions for you are numbered P1, P2, …. Status is **waiting** or **answered**, with where the answer was recorded.

## Questions for you

| # | Question | What the answer changes | Status |
|---|---|---|---|
| P1 | Do you already own a digital mixer? Which model? | Which mixer driver comes first, how many zones are possible, whether a mixer is in the budget. Current assumption: Behringer X32/M32 or X Air. | waiting |
| P2 | Typical events: venue size, guests, how many areas (zones), speakers per area? | Number of sensors, Wi-Fi vs PoE cabling, mixer size. Current assumption: 100–500 guests, 3–6 zones. | waiting |
| P3 | Is this for your own events or company, or a product to sell to others? | Off-the-shelf parts vs a custom sensor PCB, certification, installer tooling (Phase 5). | waiting |
| P4 | Are the speakers powered (active) or passive with amplifiers? Any Dante/AES67 network audio? | How zone buses reach the speakers, and whether network audio carries them. | waiting |
| P5 | Budget for the first pilot (beyond speakers and mixer)? | Pilot kit (~$280) vs going straight to the event kit (~$1,250). | waiting |
| P6 | Which country are the events in? | Legal sound limits and logging rules to preset. Prices/currency. | waiting |
| P7 | You sent two handoff documents that disagree. One says build in `mayerspitz/tailored-travel-planning` on an orphan branch `project/<slug>`. The other says build in `mayerspitz/test` in a `<project-name>/` folder on the session's branch. This session is in `mayerspitz/test`, so I followed the second. Is that right? | Where the project lives and how it later moves to its own repo. | waiting |
| P8 | Ready-made route or build ZoneMix? See [ALTERNATIVES.md](ALTERNATIVES.md). | Whether Phase 1 is building the controller, or programming a Q-SYS/AtlasIED processor instead. | waiting |

## To do

| Item | Phase | Status |
|---|---|---|
| Controller service: engine + driver + gateway, meter subscription, mixer-loss alarm, start-up self-check | 1 | not started |
| Read X32 channel meters (`/meters/1`); confirm pre- vs post-fader on real hardware | 1 | not started |
| X Air meter format (int16, 1/256 dB) on real hardware | 1 | not started |
| Web app (phone-first PWA), advisory mode, hold button | 1 | not started |
| Calibration wizard (mixer oscillator or playback channel) | 1 | not started |
| Compliance report | 1 | not started |
| Online simulator demo (Render, free plan) | 1 | not started |
| Sensor firmware + enclosure | 2 | not started |
| Working name "ZoneMix": tell me if you want another; renaming is easy | — | open |
