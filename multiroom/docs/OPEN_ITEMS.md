# Open items

What's still open for the Home Audio project, and whose turn it is. This is updated as we go.
_Last updated: 2026-09-29_

> **Start with [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)**: the single source of truth for requirements, the home, the devices and every decision with its reasoning. This file is the live to-do and question list. [PLAN_DISCUSSION.md](PLAN_DISCUSSION.md) keeps the handoff comparison (historical).

**App:** https://home-audio-kx2w.onrender.com (password login) · **Demo:** https://home-audio-kx2w.onrender.com/demo/ (Render free plan; the first visit after it has been idle takes about a minute)

## Decisions made

| Decision | Notes |
|---|---|
| Separate branch `claude/upbeat-edison-2k76xq`, never merged into `main` | |
| ~~Architecture: one hub + one small bridge per Bluetooth speaker~~ (superseded by the central Pi below) | Volume on the stream only, never on the speaker (still true) |
| Control is **web-based** for now (phone browser / home-screen app) | You use Android, but the app doesn't depend on the phone platform. No native app for now |
| Public demo on Render | Simulated speakers; for trying the app, not for real use |
| Preview a song on your phone (🎧) before sending it to a speaker | Built |
| **One central Raspberry Pi** with one USB Bluetooth adapter per speaker (2026-09-28) | Replaces the bridge-per-speaker design |
| **Capacity for 10 speakers**, adapters bought per speaker | 6→10 adds only ~$80–90; the pilot confirms how many run stably |
| House: 2 floors, 20 × 50 ft each | Pi near the middle / stairwell; active USB extension upstairs as the fallback |
| **Hub fully in the cloud (Render)**; the home Pi connects out over Wi-Fi (5 GHz) | Details and choices: [PLAN_DISCUSSION.md §6](PLAN_DISCUSSION.md#6-cloud-design-whats-decided-and-what-needs-your-choice) |
| ~~`demo.<domain>` and `app.<domain>`~~ | Superseded: no domain; `/` and `/demo/` on the free plan (Round 3). Subdomain support stays in code |

| **Round 3 (2026-09-28): cloud app on the Render free plan; music stays on the Pi's SSD** | Chosen over cloud storage; a minute's delay after a restart is fine |
| One address: the real app at `/`, the demo at `/demo/` | No domain needed |
| One login with a fixed password | Stored as `MULTIROOM_TOKEN` in Render, not in git |
| Strong 5 GHz Wi-Fi for the Pi | |
| Any Bluetooth speaker ("universal") | Only standard Bluetooth audio (A2DP); no brand-specific features |
| YouTube Music fetched by the Pi (home internet), and a 3-adapter pilot first | Accepted as proposed |

| **Mixed playlists** (library + YouTube + links); YouTube Music playlist links play now or join the queue (2026-09-29) | Built |
| Old demo address forwards to the new app's /demo/ | No dashboard step needed |
| Parts to order | [SHOPPING_LIST.md](SHOPPING_LIST.md). **Pi 5 4 GB** confirmed (P8) |
| **Separate rooms are a must** (2026-09-29): keep the Sony for room A and add one Bluetooth amp per other wired room | [SPEAKERS.md](SPEAKERS.md#getting-separate-rooms-the-plan) |
| **Live input** from any MP3 player or phone (Bluetooth receiver or cable) | Built ([LIVE_INPUT.md](LIVE_INPUT.md)) |

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

## Latest (2026-09-29)

- **Sony STR-DH190 confirmed.** It's single-zone: A/B play the same song ([SPEAKERS.md](SPEAKERS.md)). **Decision (user): separate rooms are a must.** Plan: keep the Sony for room A, and give every other wired room its own Bluetooth amp (Fosi BT20A Pro). A new multi-zone receiver wouldn't help because it has only one Bluetooth input ([SPEAKERS.md](SPEAKERS.md#getting-separate-rooms-the-plan)). Pending: the user checks which rooms A and B feed, and how many wired rooms there are.
- **New: live input.** Play from any MP3 player or phone (Bluetooth "Home Audio" receiver) or by cable (USB line-in) on any speaker ([LIVE_INPUT.md](LIVE_INPUT.md)). The parts list now has +1 UB500 for this.

## Answers received (2026-09-29)

- **P1:** the MP3 players connect over **Bluetooth**
- **P2:** speaker list comes later; the design works with any classic-Bluetooth speaker
- **P3:** the Pi sits mid-house; outdoors is wanted if cheap, so an optional 16 ft active USB extension (≈ $15) is on the list
- **P4:** usually **3 at once**
- **P5:** under 100 GB today, so 500 GB is plenty
- **P6:** USA
- **P7:** nothing owned yet (card reader added)
- **P8:** **Pi 5**
- **P9:** **as automatic as possible**
  - one-line installer (`curl -fsSL <app>/install.sh | bash`)
  - speakers added from the app (Settings → Add a speaker)
- **P10:** separate 2.4/5 GHz networks plus guest: the Pi joins the main 5 GHz network
- **P11:** the same song may play on two speakers; independent playback is fine, no sync needed

## Pre-purchase questions P1–P11
All answered; see "Answers received" above. The wording is in [history/CONVERSATION_LOG.md](history/CONVERSATION_LOG.md).

## Questions for you

| # | Question | Why it matters | Status |
|---|---|---|---|
| S1 | **Which rooms do the Sony's SPEAKERS A and B feed, and are there more wired speaker pairs** (e.g. a speaker selector box)? Test: set SPEAKERS to A only, then B only, and walk around | Sets how many Bluetooth amps to buy (one per wired room besides room A) | ⏳ waiting for you |
| S2 | **The rest of your speakers**: model or label photo, room/floor, battery or plugged in | Adapter count; per-speaker tips | ⏳ waiting for you (you said you'll share them) |
| Q9 | Features you'd like next, if any (see the backlog below) | Scope of the next round | ⏳ whenever you like |
| ~~Q1–Q3~~ | Current whole-home system, upstairs, scan | | ✅ It's the Sony STR-DH190: single zone. Separate rooms come from Bluetooth amps (D-20) |
| ~~Q4–Q8, Q10, Q11, R1–R10, P1–P11~~ | Speakers, network, hub choice, YouTube, remote access, cloud, parts | | ✅ answered; see [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) §2–§5. Remote access is the cloud app (no Tailscale needed) |

## To do: pilot on real hardware (central Pi + 3 adapters)

| # | Item | Status |
|---|---|---|
| H1 | One-line install on Raspberry Pi OS Lite 64-bit (Pi 5): SSD auto-mount, services, system check all green | ☐ |
| H2 | Add 3 speakers in the app, including the **farthest on the other floor** (~29 ft through the floor) | ☐ |
| H3 | **The speaker's own volume never changes** when the app's slider moves (key acceptance test) | ☐ |
| H4 | Auto-reconnect after a speaker is switched off and on; the Sony wakes from Bluetooth Standby | ☐ |
| H5 | 3 different songs on 3 speakers for an hour with no dropouts; check the hub for multi-TT (`lsusb -v \| grep -i TT`) | ☐ |
| H6 | YouTube Music from the home internet (yt-dlp + Deno) | ☐ |
| H7 | Live input: pair an MP3 player or phone to "Home Audio" and play it on a speaker | ☐ |
| H8 | The Fosi amp in room B plays a different song from the Sony in room A | ☐ |

## Backlog: possible features (not started, pending Q9)

- Synchronized "party mode": the same song on several speakers, in time (e.g. using Snapcast)
- Per-speaker maximum volume (e.g. a kids' room limit), and a sleep timer
- Favourites; drag-to-reorder in the queue (saved playlists are done)
- A proper session login (preview links currently carry the password in the URL)
- Schedules (morning music in the kitchen at 7:00)
- Adding the existing whole-home system's players as extra "speakers", if it turns out to be Sonos, HEOS, BluOS or WiiM
- A native Android app (the API is ready: [API.md](API.md))

## Known limitations of the demo

- Speakers are simulated. "Listen on this phone" (🎧) plays a speaker's stream in your browser, so you can hear what it would play.
- YouTube Music is off on the demo (no yt-dlp there; YouTube also blocks most cloud servers).
- Uploads are capped at 25 MB per file. All data resets when the demo restarts or is redeployed, and everyone with the link shares it.
- On Render's free plan the demo sleeps after 15 minutes idle; the first visit then takes about a minute to wake it.
