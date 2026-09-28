# Open items

What's still open for the Home Audio project, and whose turn it is. This is updated as we go.
_Last updated: 2026-09-28_

> **Hardware and setup are being finalized in [PLAN_DISCUSSION.md](PLAN_DISCUSSION.md).** It compares the earlier agent's handoff (10 speakers, one central Pi with 10 USB Bluetooth adapters, 500 GB SSD) with this build, and lists questions Q-A to Q-I. Nothing from the handoff counts as decided until you confirm it there.

**Demo:** https://home-audio-demo.onrender.com (Render free plan; the first visit after it has been idle takes about a minute)

## Decisions made

| Decision | Notes |
|---|---|
| Separate branch `claude/upbeat-edison-2k76xq`, never merged into `main` | |
| Architecture: one hub + one small bridge per Bluetooth speaker | Up to 6+ independent streams; volume on the stream only, never on the speaker |
| Control is **web-based** for now (phone browser / home-screen app) | You use Android, but the app doesn't depend on the phone platform. No native app for now |
| Public demo on Render | Simulated speakers; for trying the app, not for real use |
| Preview a song on your phone (🎧) before sending it to a speaker | Built |

## Done since the last update

- 🎧 **Preview on this phone:** every song in the picker and the library can be heard on the phone only, before it goes to a speaker
- 🎧 on a speaker card: listen along to what that speaker is playing
- Storage (music size, disk free) in Settings
- Bluetooth adapters can be named by their own address, so 10 identical USB adapters can't get mixed up after a reboot

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
| Q10 | **Demo + production on one Render app** (`demo.<name>` / `app.<name>`): which domain? Is production a hub at home reached through a tunnel (recommended), or a hub in the cloud? See [PLAN_DISCUSSION.md §4](PLAN_DISCUSSION.md#4-demo-and-production-on-one-render-app) | Changes the architecture and the monthly cost | ⏳ waiting for you |
| Q11 | **6 or 10 speakers; one central box, bridges, or a hybrid?** Needs a speaker map: rooms, floors, distances. See [PLAN_DISCUSSION.md](PLAN_DISCUSSION.md) | Main hardware decision | ⏳ waiting for you |
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
