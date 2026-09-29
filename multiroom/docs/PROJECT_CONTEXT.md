# Project context: the single source of truth

**Future agents and compacted sessions: read this file first.** It records who the user is, the home, the devices, every requirement and decision with its reasoning, what's built, where it runs, and what's still open. The other docs have the details. When something changes, update this file in the same commit.

_Last updated: 2026-09-29_

Related files:

- [OPEN_ITEMS.md](OPEN_ITEMS.md): live to-do list and questions
- [history/CONVERSATION_LOG.md](history/CONVERSATION_LOG.md): every user message word for word, with a summary of each reply
- [history/RESEARCH_NOTES.md](history/RESEARCH_NOTES.md): verified technical facts with sources
- [history/HANDOFF_2026-09-28.pdf](history/HANDOFF_2026-09-28.pdf): the earlier agent's handoff (superseded where it differs; see §4)

---

## 1. Working rules (from the user; always follow)

| Rule | Source |
|---|---|
| Work only on branch **`claude/upbeat-edison-2k76xq`**. **Never merge to `main`**, and open no pull request unless asked | First message |
| **Never commit the app password.** It lives only in Render's env var `MULTIROOM_TOKEN` on service `home-audio`. The user knows it | Round 3 |
| **Don't ask questions the user already answered, or ones you can work out yourself.** E.g. distances follow from the house size in §2. The user called such a question "stupid" | Answer to P3 |
| Before implementing or recording something from the old handoff or another agent, **check contradictions with the user**; don't trust it blindly | Handoff message |
| Make everything **as automatic as possible**: no manual Render dashboard steps, and a one-line Pi install | "Try to do without my manual dashboard update", P9 |
| Off-the-shelf hardware is a plus, but **never at the cost of quality or end result** | First message |
| Keep **all open questions in [OPEN_ITEMS.md](OPEN_ITEMS.md)**; the user follows up later | Round 1 |
| Test fully before saying something's done, and be honest about what couldn't be tested (no real Pi or speakers in the sandbox) | "Make sure everything is fully ready…" |
| Commit messages end with the session's `Co-Authored-By` / `Claude-Session` trailer lines. No model names in commits | Session setup |

## 2. The user, the home, the infrastructure

| Topic | Fact | Source |
|---|---|---|
| Location | USA (US plugs, Amazon US) | P6 |
| Phone | **Android**, but the app must be **web-based** (phone browser / home-screen app); no native app for now | Round 1 |
| House | **2 floors, each 20 × 50 ft** (~1,000 sq ft per floor) | Round 2 |
| Pi placement | **One central Pi in the middle of the house** (ideally by the stairwell). Distances: far end of the same floor ≈ 25–27 ft (8 m); far end of the other floor ≈ 29 ft (9 m) through the floor | Round 2 + P3 |
| Wi-Fi | **Strong Wi-Fi.** Router shows **separate 2.4 GHz and 5 GHz networks, each with a guest network.** The Pi uses the **main 5 GHz** network (not guest: guest often isolates clients, and 2.4 GHz competes with Bluetooth). Wi-Fi extenders exist but don't help Bluetooth range | Round 3, P10 |
| Ethernet | Not planned; the Pi uses Wi-Fi 5 GHz | Round 2 ("Pi connect via Wi-Fi") |
| Music | **Under 100 GB** today, from several MP3 players (one per speaker). The 500 GB SSD is enough | P5 |
| Today's setup | Each MP3 player connects to its speaker **over Bluetooth** | P1 |
| Hardware owned | **Nothing yet** (no Pi, SSD, hub or card reader) | P7 |
| Domain | **None.** Use the Render address; the demo lives under `/demo` | Round 3 |
| Render | Free plan only. The user doesn't mind waiting a minute or so after a restart | Round 3 |

## 3. Devices (audio)

| Device | Facts | Status in the plan |
|---|---|---|
| **Sony STR-DH190** stereo receiver (the "built-in sound system"; model confirmed by the user) | 2-channel, **single zone**. SPEAKERS **A/B** only picks which wired speaker pairs play, and both play the **same** source. No Zone 2. Has Bluetooth input and Bluetooth Standby. The previous owner claimed it does different songs per room; **that's false** ([manual p.13](https://www.manualslib.com/manual/1348935/Sony-Str-Dh190.html?page=13)) | One app speaker (room A). Rooms on its B terminals get their own Bluetooth amp (§5, D-18) |
| **BolaButty X-GO C27-C** | Bluetooth 5.3 battery speaker, TWS capable ([manual](https://manuals.plus/bolabutty/bolabutty-c27c-waterproof-bluetooth-speaker-user-manual)) | Works; don't use TWS; keep it charged |
| Wired in-wall/ceiling speakers | Connected to the Sony's A and B terminals. **Unknown:** which rooms A and B feed, and whether there are more wire pairs | User to check (OPEN_ITEMS) |
| More speakers | "Random" brands. The user will list them later. The design must work with **any** Bluetooth speaker (A2DP) | Universal by design |
| MP3 players / other audio players | The user wants to **stream live from them** (any player) instead of files or YouTube | Built: live input (D-17) |
| Earlier whole-home system question | The user's first message asked whether "the system that controls all rooms" can play a different song per room, and upstairs too. It turned out to be the Sony: **no**. The scanner and the 2-song test in [VERIFY_EXISTING_SYSTEM.md](VERIFY_EXISTING_SYSTEM.md) remain for any other system | Answered |

## 4. Requirements and goals

1. **Separate music per speaker/room at the same time**: originally up to 6, now capacity for **10**; usually **3 at once** (P4). **"I must have separate room capability"** (2026-09-29): hard requirement.
2. Sources:
   - uploaded files from all the MP3 players (one collection per player)
   - **YouTube Music**: search, song, album and **playlist links**; play a playlist now or add it to a queue
   - **mixed queues and saved playlists** (local + YouTube + links in any order)
   - any stream URL (the user's own custom app / web app)
   - **live input** from any MP3 player or phone
3. Control from the phone, remotely, through **a web app the user can build on** (REST + WebSocket API: [API.md](API.md)).
4. **Online status** per speaker.
5. **Volume = stream (software) volume only. The speaker's own volume must never change.** Bluetooth absolute volume (AVRCP) is off.
6. 🎧 **Preview on this phone** before playing loud on a speaker (the user's idea), plus listen-along.
7. **Same song on two speakers is allowed** (no restrictions), but **no sync needed** in this version (P11).
8. **Outdoor speaker:** wanted if not much harder or pricier. Answer: a 16 ft active USB extension (~$15).
9. **Most automatic setup possible:** one-line installer, speakers added from the app, SSD found automatically, system check.
10. Appliance behaviour: boots, mounts the SSD, reconnects speakers, and starts everything with no keyboard or monitor (also in the handoff).

## 5. Decisions log (chronological, with reasoning)

| # | Date | Decision | Why / alternatives rejected |
|---|---|---|---|
| D-1 | 09-28 | Linux (Raspberry Pi) + BlueZ + PipeWire/WirePlumber + **mpv per speaker**, Node.js hub | Android/tablets can't route many independent streams to many Bluetooth speakers. WiiM-type streamers change the speaker's volume over AVRCP (breaks req. 5) and handle one Bluetooth speaker each |
| D-2 | 09-28 | Web app first, platform-neutral; API documented for the user's own apps | User is on Android but wants web |
| D-3 | 09-28 | Demo on Render with simulated speakers and generated tone "songs" | User asked to try it before buying |
| D-4 | 09-28 | 🎧 preview on phone + listen-along | User's request |
| D-5 | 09-28 | Handoff reviewed, not trusted blindly: matches on Linux, stream volume, web app, 500 GB SSD, 1 adapter per speaker. Differences (6 vs 10; central vs bridge per speaker; Pi 4 vs Pi 5; Ethernet vs Wi-Fi) were put to the user ([PLAN_DISCUSSION.md](PLAN_DISCUSSION.md)) | User instruction |
| D-6 | 09-28 | **One central Pi** with **one USB Bluetooth adapter per speaker** on a powered USB hub; the per-speaker "bridge" Pi design is dropped (the code still supports it as a fallback) | User's choice. Central is much cheaper (~$445 vs ~$860 for 10). Range checked: ≤ ~29 ft |
| D-7 | 09-28 | **Capacity for 10 speakers**, adapters bought per speaker actually owned | 6→10 adds only ~$80–90 ("6 if significant budget difference, otherwise more") |
| D-8 | 09-28 | **Cloud control**: the app runs on Render, and the home Pi connects **out** to it (WebSocket tunnel; no router setup) | User: "Cloud fully… Pi connect via Wi-Fi" |
| D-9 | 09-28 | **Render free plan**; **music stays on the Pi's SSD** (option S3). Cloud storage (S2, R2 ~$15/mo) and a Render disk (S1, ~$132/mo) rejected | User: free deploy, data on SSD. Free-plan side effects handled: the Pi backs up and restores state and pings every 10 min to keep the app awake |
| D-10 | 09-28 | **No domain**: real app at `/`, demo at `/demo/` on the same service (`demo.`/`app.` subdomains also supported in code if a domain comes later) | User has no domain |
| D-11 | 09-28 | **One login, fixed password**, stored only as Render env `MULTIROOM_TOKEN` | User's choice. Known limitation: preview/listen links carry the token in the URL; a session login is on the backlog |
| D-12 | 09-28 | **YouTube via yt-dlp on the Pi** (home internet), signed out, updated daily, with Deno as the JS runtime | YouTube blocks cloud IPs. Premium allows only one stream per account. Unofficial: user accepted ("all the rest of your suggestions, I'm okay") |
| D-13 | 09-28 | **3-adapter pilot first**, then buy the rest | Proves range, hub and multi-stream stability before spending |
| D-14 | 09-29 | **Mixed playlists** saved in the app (stored with speaker state, so they're in the Pi backup); YouTube playlist links: Play all / Shuffle / Add to queue / Save | User's request |
| D-15 | 09-29 | Old Render service `home-audio-demo` **redirects** to the new `/demo/` instead of the user deleting it | "Try to do without my manual dashboard update" |
| D-16 | 09-29 | **Raspberry Pi 5 4 GB** (not the handoff's Pi 4) | After 2026 price rises it's only ~$10 more. Two USB controllers (SSD and Bluetooth hub separate). User confirmed P8 |
| D-17 | 09-29 | **Automatic setup:** `curl -fsSL https://home-audio-kx2w.onrender.com/install.sh \| bash` → SSD autodetect/mount → install → reboot. Speakers added in the app (Settings → Add a speaker). System check ("doctor") in the app | P9 "most automatic as possible" |
| D-18 | 09-29 | Robustness fixes found in a pre-hardware review: wait for the SSD mount; never play on the wrong speaker (`requireSink`); keep retrying a late speaker sink; never use the Pi's built-in Bluetooth radio | "Make sure everything is fully ready" |
| D-19 | 09-29 | **Live input:** the Pi acts as a Bluetooth receiver named **"Home Audio"** (one extra UB500), or takes a **cable** via a USB line-in (Behringer UCA202). Any speaker can play it (Picker → Live) | User's request (MP3 players and any audio player) |
| D-20 | 09-29 | **Separate rooms on the wired speakers: keep the Sony for room A, and give every other wired room its own Bluetooth amp** (Fosi Audio BT20A Pro, ~$100). **Not** a new multi-zone receiver | User: "I must have separate room capability… I'll change the receiver if needed". Zone-2 receivers cost $500+, give only 2 zones and have one Bluetooth input, so the Pi can't feed two streams to them. One amp = one independent room. Details: [SPEAKERS.md](SPEAKERS.md#getting-separate-rooms-the-plan) |

## 6. What's built (on this branch, in `multiroom/`)

- **hub/** (Node 20+, Express 5, ws):
  - library (uploads, metadata, covers)
  - YouTube (yt-dlp resolve and search, a Range-aware proxy)
  - queues per speaker (replace/now/next/append, shuffle, repeat)
  - playlists
  - the setup API (scan, pair, remove speakers; receiver mode; system check)
  - live inputs (`parec` → endless WAV)
  - the cloud tunnel (`home-tunnel.js`, `home.js`), the site with `/demo`, and the installer routes
- **hub/public/**: the phone web app. Tabs: Speakers, Library, Playlists, Settings. It includes the picker (Library / YouTube / Playlists / Live), 🎧 preview, the Add-a-speaker wizard, Music players (receiver) and the system check.
- **agent/**: speaker player. mpv over IPC with software volume; BlueZ via busctl; adapter chosen by address; reconnect with backoff.
- **deploy/**:
  - `auto-setup.sh`: SSD, T7 UAS quirk, `dtoverlay=disable-bt`
  - `install-home.sh`: apt, WirePlumber drop-in with hardware volume off, BlueZ Class, bluez-tools, services
  - `doctor.sh`, plus the older bridge/hub scripts
- **tools/**: `discover-audio-systems.js`, a network scanner for Sonos, HEOS, Yamaha, BluOS, WiiM, Bose and Russound.
- **Tests:** `npm test` → 65 pass (hub 51, agent 7, tools 7). Also checked:
  - browser flows with Playwright
  - real mpv playing the live stream
  - an install rehearsal of the bundle

The key technical gotchas are in [history/RESEARCH_NOTES.md](history/RESEARCH_NOTES.md). For example, `bluez5.hw-volume` must go in device rules, not monitor properties.

## 7. Where it runs

| Thing | Value |
|---|---|
| Real app | https://home-audio-kx2w.onrender.com (password) |
| Demo | https://home-audio-kx2w.onrender.com/demo/ |
| Render service | `home-audio` (srv-datfcp093c1s73ad5vsg), free plan, auto-deploys this branch. Start command `cd multiroom && npm run site`. Env: `NODE_VERSION=22`, `MULTIROOM_TOKEN` (secret) |
| Old service | `home-audio-demo` (srv-dateb97avr4c73d71h7g). Env `REDIRECT_TO=…/demo/`, so it only redirects. Harmless to keep |
| Render workspace | tea-d97ieknaqgkc73ejas5g |
| Blueprint | `/render.yaml` at the repo root |
| Home Pi | Not set up yet: parts not bought. Guide: [SETUP_CLOUD.md](SETUP_CLOUD.md) |

## 8. Hardware to buy

The full list is in [SHOPPING_LIST.md](SHOPPING_LIST.md). Pilot ≈ $375:

- Pi 5 4 GB, 27 W power supply, official case, 32 GB microSD, card reader
- Samsung T7 500 GB SSD
- Plugable USB3-HUB10C2 powered hub, 1 ft extension cables
- **UB500 × 3 for speakers + 1 for the "Home Audio" receiver**

Add one UB500 per extra speaker, one **Fosi BT20A Pro per extra wired room** (D-20), and optionally a UCA202 (cable input) and a 16 ft active USB extension (outdoor).

## 9. Verified vs. not yet verified

- **Verified in the sandbox:**
  - all software paths, with fake BlueZ/pactl and real mpv
  - the cloud tunnel and restore after a restart
  - the installer bundle
  - browser UI flows
  - Render deploys
- **Needs the real hardware** (the pilot):
  - range upstairs
  - several Bluetooth streams on one hub (and whether the hub is multi-TT)
  - that the speaker's own volume truly never changes (key acceptance test)
  - YouTube from the home internet
  - the Sony's Bluetooth Standby wake-up
  - the Fosi amp in the app
  - the installer on real Raspberry Pi OS

## 10. Next steps

1. User: check which rooms the Sony's A and B terminals feed and how many wired rooms there are. Then order the pilot, plus one Fosi amp per extra wired room.
2. User: send the remaining speaker models.
3. Install day ([SETUP_CLOUD.md](SETUP_CLOUD.md)), then the pilot checks in [OPEN_ITEMS.md](OPEN_ITEMS.md).
