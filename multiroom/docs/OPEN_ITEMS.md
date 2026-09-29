# Open items

What's still open for the Home Audio project, and whose turn it is. This is updated as we go.
_Last updated: 2026-09-29_

> **Hardware and setup are being finalized in [PLAN_DISCUSSION.md](PLAN_DISCUSSION.md).** It compares the earlier agent's handoff (10 speakers, one central Pi with 10 USB Bluetooth adapters, 500 GB SSD) with this build, and lists questions Q-A to Q-I. Nothing from the handoff counts as decided until you confirm it there.

**App:** https://home-audio-kx2w.onrender.com (password login) · **Demo:** https://home-audio-kx2w.onrender.com/demo/ (Render free plan; the first visit after it has been idle takes about a minute)

## Decisions made

| Decision | Notes |
|---|---|
| Separate branch `claude/upbeat-edison-2k76xq`, never merged into `main` | |
| Architecture: one hub + one small bridge per Bluetooth speaker | Up to 6+ independent streams; volume on the stream only, never on the speaker |
| Control is **web-based** for now (phone browser / home-screen app) | You use Android, but the app doesn't depend on the phone platform. No native app for now |
| Public demo on Render | Simulated speakers; for trying the app, not for real use |
| Preview a song on your phone (🎧) before sending it to a speaker | Built |
| **One central Raspberry Pi** with one USB Bluetooth adapter per speaker (2026-09-28) | Replaces the bridge-per-speaker design |
| **Capacity for 10 speakers**, adapters bought per speaker | 6→10 adds only ~$80–90; the pilot confirms how many run stably |
| House: 2 floors, 20 × 50 ft each | Pi near the middle / stairwell; active USB extension upstairs as the fallback |
| **Hub fully in the cloud (Render)**; the home Pi connects out over Wi-Fi (5 GHz) | Details and choices: [PLAN_DISCUSSION.md §6](PLAN_DISCUSSION.md#6-cloud-design-whats-decided-and-what-needs-your-choice) |
| `demo.<domain>` and `app.<domain>` served by one Render service | Built (`npm run site`); needs a domain and the Starter plan to go live |

| **Round 3 (2026-09-28): cloud app on the Render free plan; music stays on the Pi's SSD** | Chosen over cloud storage; a minute's delay after a restart is fine |
| One address: the real app at `/`, the demo at `/demo/` | No domain needed |
| One login with a fixed password | Stored as `MULTIROOM_TOKEN` in Render, not in git |
| Strong 5 GHz Wi-Fi for the Pi | |
| Any Bluetooth speaker ("universal") | Only standard Bluetooth audio (A2DP); no brand-specific features |
| YouTube Music fetched by the Pi (home internet), and a 3-adapter pilot first | Accepted as proposed |

| **Mixed playlists** (library + YouTube + links); YouTube Music playlist links play now or join the queue (2026-09-29) | Built |
| Old demo address forwards to the new app's /demo/ | No dashboard step needed |
| Parts to order | [SHOPPING_LIST.md](SHOPPING_LIST.md). Proposed: **Pi 5 4 GB** instead of Pi 4 (≈ $10 more, separate USB controllers); please confirm |

## Done since the last update

- **Playlists tab:** build playlists mixing library songs, YouTube Music songs and links; reorder, rename, preview, play or shuffle on any speaker
- Anywhere in the picker: ⋯ → Play next / Add to playlist; the queue has **Save as playlist**
- **YouTube Music playlist links:** Play all / Shuffle / Add all to queue / Save as playlist
- The demo has a clearly labelled pretend YouTube catalog and a ready-made mixed playlist, so all of this can be tried there

- **Cloud mode:** the cloud app handles control, and the home Pi handles the music, speakers and YouTube, over an outgoing connection
  - The Pi backs up speakers and queues and restores them after a free-plan restart (tested: the song keeps playing)
  - Keep-alive pings every 10 minutes; a "Home Pi offline" banner in the app
- `deploy/install-home.sh` + `deploy/home-speaker.sh`, and the guide [SETUP_CLOUD.md](SETUP_CLOUD.md)

- 🎧 **Preview on this phone:** every song in the picker and the library can be heard on the phone only, before it goes to a speaker
- 🎧 on a speaker card: listen along to what that speaker is playing
- Storage (music size, disk free) in Settings
- Bluetooth adapters can be named by their own address, so 10 identical USB adapters can't get mixed up after a reboot

## Before buying: questions that can change the order (2026-09-29)

| # | Question | What changes if the answer is… |
|---|---|---|
| P1 | How do the MP3 players reach the speakers today: **Bluetooth, or a cable (AUX)**? | Cable-only speakers need a small Bluetooth receiver each (~$20), or a different plan |
| P2 | **List of speakers:** model (or photo of the label), and plugged in or battery? | Very new speakers that only do "LE Audio / Auracast" won't work with classic Bluetooth; battery speakers auto-switch off |
| P3 | **How many play at the same time, usually and at most?** | Hub size and how many adapters to buy after the pilot |
| P4 | **Farthest speaker:** which room/floor, any **outdoors** or behind a thick/exterior wall, from where the Pi would sit? | Range: may need a USB extension run or a second hub closer to those speakers |
| P5 | **How much music** is on all the MP3 players combined (GB)? Any protected files (Audible, iTunes-DRM, protected WMA)? | 500 GB may be more (or less) than needed; protected files can't play |
| P6 | **Your country**, and so which plugs / Amazon store? | Power supply plug type and product availability |
| P7 | Do you **already own** any of: a Raspberry Pi, SSD, powered USB hub, microSD card, microSD card reader for your computer? | Don't buy twice; if your computer has no SD slot, add a ~$8 USB card reader |
| P8 | **Pi 5 (recommended, ≈$10 more) or Pi 4?** | Changes items 1–3 of the list |
| P9 | Will you run the setup commands yourself (copy/paste over SSH), or would you prefer a more "plug-in-and-go" setup? | I can make setup more automatic before the parts arrive |
| P10 | Your router: does it show **separate 2.4 GHz and 5 GHz networks**, or one combined name? Any guest network or "client isolation"? | The Pi must stay on 5 GHz and reach the internet |
| P11 | Will two speakers ever play **the same song in the same space** (e.g. open-plan rooms)? | Independent speakers aren't time-synced; "party mode" sync would be a software addition, not hardware |

## Questions for you

| # | Question | Why it matters | Status |
|---|---|---|---|
| Q1 | **What is your current whole-home system?** Brand/model, the app you use, keypads, equipment-closet labels | Needed to say whether each room can really play a different song | ⏳ waiting for you |
| Q2 | **Upstairs: same equipment and network?** Is there a second router/extender or a different Wi-Fi name upstairs? Are the upstairs speakers wired to the same box as downstairs, or to a "Zone 2" output? | The usual reasons upstairs behaves differently | ⏳ waiting for you |
| Q3 | Scan and test results: run `node tools/discover-audio-systems.js` downstairs and upstairs (`--compare`), plus the 15-minute two-song test | The definitive answer for Q1/Q2 ([VERIFY_EXISTING_SYSTEM.md](VERIFY_EXISTING_SYSTEM.md)) | ⏳ waiting for you |
| Q4 | Which Bluetooth speakers (models), how many (up to 6), and which rooms? Mains or battery powered? | Pairing, auto-off behaviour, bridge count | ⏳ waiting for you |
| Q5 | Is there Ethernet near each speaker, or will the bridges use Wi-Fi? Is 5 GHz Wi-Fi available on both floors? | Audio stability | ⏳ waiting for you |
| Q6 | Hub: reuse a computer/NAS you already own, or buy a Raspberry Pi 5? | Cost ($130 difference) | ⏳ waiting for you |
| Q7 | YouTube Music via yt-dlp: are you comfortable with it (unofficial, may conflict with YouTube's terms)? Signed out (no per-account stream limit) or with your account? | Premium allows 1 stream per account, which conflicts when several rooms play YouTube | ⏳ waiting for you |
| Q8 | Control from outside the house: OK to use Tailscale (free, no port forwarding)? | Remote access design | ⏳ waiting for you |
| Q10 | Demo + production on one Render app | Architecture | ✅ answered: fully cloud. Domain and plan are still open (R2, R3) |
| Q11 | 6 or 10 speakers; central box or bridges | Main hardware decision | ✅ answered: one central Pi, capacity for 10 |
| R1–R8 | Round-2 questions | | ✅ answered (round 3), except the speaker models, which come later |
| R9 | Your current speakers (models, how many), whenever convenient | Pilot planning; the design already works with any speaker | ⏳ later |
| R10 | Approve the parts list in [SHOPPING_LIST.md](SHOPPING_LIST.md). Pi 5 or Pi 4? | Ready to order the pilot | ⏳ waiting for you |
| Q9 | Features you'd like next, if any (see the backlog below) | Scope of the next round | ⏳ waiting for you |

## To do: needs real hardware (first pilot: 1 hub + 1 bridge + 1 speaker)

| # | Item | Status |
|---|---|---|
| H1 | Run `install-hub.sh` on Raspberry Pi OS (64-bit, trixie) | ☐ not yet run on a Pi |
| H2 | Run `install-agent.sh`/`pair-speaker.sh` with a real speaker and a TP-Link UB500 | ☐ |
| H3 | **Confirm the speaker's own volume never changes** (WirePlumber drop-in: no AVRCP absolute volume) | ☐ key acceptance test |
| H4 | Auto-reconnect after the speaker is switched off and on; pause/resume behaviour | ☐ |
| H5 | Audio quality and stability over Wi-Fi 5 GHz vs Ethernet; the Pi's built-in Bluetooth vs the USB adapter | ☐ |
| H6 | YouTube Music live on the hub (yt-dlp + Deno) — can't be tested from the build sandbox | ☐ |
| H7 | Six simultaneous streams on the final hardware | ☐ |

## Backlog: possible features (not started, pending Q9)

- Synchronized "party mode": the same song on several speakers, in time (e.g. using Snapcast)
- Per-speaker maximum volume (e.g. a kids' room limit), and a sleep timer
- Saved playlists and favourites; drag-to-reorder in the queue
- Schedules (morning music in the kitchen at 7:00)
- Adding the existing whole-home system's players as extra "speakers", if it turns out to be Sonos, HEOS, BluOS or WiiM
- A native Android app (the API is ready: [API.md](API.md))

## Known limitations of the demo

- Speakers are simulated. "Listen on this phone" (🎧) plays a speaker's stream in your browser, so you can hear what it would play.
- YouTube Music is off on the demo (no yt-dlp there; YouTube also blocks most cloud servers).
- Uploads are capped at 25 MB per file. All data resets when the demo restarts or is redeployed, and everyone with the link shares it.
- On Render's free plan the demo sleeps after 15 minutes idle; the first visit then takes about a minute to wake it.
