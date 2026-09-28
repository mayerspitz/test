# Hardware & setup plan: for discussion

**Status: draft for discussion. Items become decisions only after you confirm them; your round-2 answers are in §0.** Confirmed answers move into [OPEN_ITEMS.md](OPEN_ITEMS.md) ("Decisions made") and the other docs.

This compares three sources:

- the earlier agent's handoff ("Multi-Speaker Bluetooth Streaming Controller", 10 speakers / 500 GB SSD)
- what is built on this branch
- what you asked for in this conversation

You mentioned that your thinking has changed since the handoff. So wherever they disagree, I list it as a question rather than picking one.

---

## 0a. Round 3: final answers (2026-09-28)

| You said | Result |
|---|---|
| The cloud app controls everything, on the **free** plan; **the Pi keeps the data on its SSD**; waiting a few minutes for a change is fine | Storage **S3** (§6): $0/month. **Built:** cloud mode, where the Pi connects out, backs up the cloud's state and keeps it awake. See [SETUP_CLOUD.md](SETUP_CLOUD.md). |
| Strong Wi-Fi | The Pi uses 5 GHz Wi-Fi |
| No domain: use the regular address, with `/demo` for the demo | **Built:** `/` = the real app, `/demo/` = the demo |
| One login, fixed password | **Built:** one password, stored in the Render settings (not in the code) |
| Speakers are mixed; design for any speaker | Only standard Bluetooth audio (A2DP) is used, and the speaker's volume is never touched. Models to share later. |
| Everything else as suggested | YouTube via the Pi, the 3-adapter pilot, capacity for 10 |

## 0. Round 2: your answers (2026-09-28)

| You said | What it means |
|---|---|
| **One central Pi** | Handoff design: one Raspberry Pi with one USB Bluetooth adapter per speaker, on a powered hub. The per-speaker bridge design is off the table (it stays possible in software as a fallback). |
| **6 speakers if the budget difference is significant, otherwise as many as fit** | With one central Pi, each extra speaker costs one adapter (~$13) plus a cable. Going from 6 to 10 adds about **$80–90** in total (4 adapters, cables, a 13-port instead of 7-port hub). That's small, so **the plan is capacity for 10**, with adapters bought per speaker you actually have. The pilot (§3) shows how many run stably from one spot. |
| **2 floors, 20 × 50 ft each** (~6 × 15 m) | From the middle of one floor, the farthest corner on the same floor is ~8 m away, and on the other floor ~9 m plus the floor itself. That is within Bluetooth range on paper; the floor is the unknown. **Put the Pi near the middle of the house, ideally by the stairwell.** If the pilot shows upstairs speakers drop out, we still keep one Pi: run **one active USB extension cable** (up to ~10–15 m) upstairs to a small powered hub holding the upstairs adapters. |
| **Fully in the cloud, controlled from the cloud; the Pi connects over Wi-Fi** | The hub (app, queues, library index, uploads) runs on Render. The home Pi only makes **outgoing** connections to it (no router setup) and drives the speakers. See §6 for the parts I need you to choose. |
| (earlier) demo + real app on one Render service | **Built** (`npm run site`): `demo.<domain>` → demo, `app.<domain>` → your real hub. It still needs a domain and a paid plan (see §6). |

## 6. Cloud design: what's decided and what needs your choice

```
 Phone ──https──► app.<domain> (Render: hub + web app)  ◄──wss (outgoing from home)── Pi at home ──Bluetooth──► 6–10 speakers
                        │                                                        │
                   music library (see choice S)                          500 GB SSD: local copy/cache
```

**Consequences of going fully cloud (please read):**

- **Render plan:** the free plan sleeps and wipes its disk, so the real hub needs the **Starter plan (~$7/month)**. The demo can share that same service.
- **Internet outage:** the app is unreachable until the internet returns. With the local copy on the Pi's SSD (recommended below), the current songs keep playing.
- **YouTube Music:** YouTube blocks most cloud-server addresses. The fix is to let **the Pi fetch YouTube audio itself**, from your home internet, and keep only search and queues in the cloud.
- **Security:** the app becomes reachable from the internet, so it needs a proper login. Today it uses one shared access token.
- **The Pi on Wi-Fi:** use the **5 GHz** network. With 10 Bluetooth radios next to it, 2.4 GHz Wi-Fi would compete with them. Ethernet is still better if a cable is ever possible.

**Choice S: where the music library (up to 500 GB) lives**

| | S1: Render disk | **S2: cloud object storage (Cloudflare R2)** + copy on the Pi's SSD (recommended) | S3: library only on the Pi's SSD, cloud does control only |
|---|---|---|---|
| Storage cost for 500 GB | ~$125/month | ~$7.50/month (no download fees) | $0 |
| Total cloud cost (with Starter) | ~$132/month | **~$15/month** | ~$7/month |
| Plays through an internet outage | No | Yes, from the Pi's copy | Yes |
| Upload from the phone anywhere | Yes | Yes | Yes, relayed to the Pi (Pi must be online) |
| Work needed | None (works today) | Storage connector + Pi sync (a few days) | Relay uploads + stream from Pi (a few days) |

---

## 1. Where the two plans agree (no action unless you object)

| Topic | Both say |
|---|---|
| Goal | One system replaces the separate MP3 players; each speaker can play a different song at the same time |
| Platform | Linux (Raspberry Pi), not an Android tablet: Android can't route many independent streams to many Bluetooth speakers |
| Software | BlueZ + PipeWire + WirePlumber, one playback process per speaker (built) |
| Volume | Stream volume only; the speaker's own volume never changes (built: Bluetooth absolute volume is off) |
| Control | Custom web app on the phone; the phone never talks Bluetooth (built, plus an API for your own apps) |
| Appliance behaviour | Boots, reconnects speakers and starts the web app on its own; no keyboard or monitor needed (built as system services) |
| Network | Ethernet for the Pi if at all possible; otherwise 5 GHz Wi-Fi |
| One Bluetooth radio per speaker | Handoff: 10 USB adapters. Build: one adapter per bridge. Same principle |

## 2. Where they differ: please decide

| # | Topic | Handoff says | Built / proposed in this chat | Question for you |
|---|---|---|---|---|
| D1 | **Number of speakers** | 10 | "up to 6" (your first message) | Is it **6 or 10**? The software has no limit; this only changes the hardware list. |
| D2 | **Where the Bluetooth radios live** | All 10 USB adapters on **one central Pi**, through a powered USB hub | **One small Pi ("bridge") next to each speaker**, connected to a central hub over the network | Depends on **where the speakers physically are** (see §3). A **hybrid** is possible, and the software already supports all three layouts. |
| D3 | Main computer | Raspberry Pi 4, **4 GB** | Pi 5 as hub (+ Pi 4 1 GB bridges) | A central-only design needs one Pi 4 4 GB, which is fine. See the price note in §5. |
| D4 | Music storage | **500 GB USB SSD** (+ microSD for the OS) | 128 GB SSD in my estimate | I'll adopt **500 GB** unless you say otherwise. |
| D5 | YouTube Music | "A separate question; must not block local files" | Built through yt-dlp (unofficial) | Keep it as an optional extra that can be switched off? See Q7 in OPEN_ITEMS. |
| D6 | Your existing whole-home system ("different song per room?", "upstairs different?") | Not mentioned | Scanner + verification guide built | Is this still relevant, or has the new system replaced that question? |
| D7 | Demo + production on one Render app (`demo.<name>` / `app.<name>`) | Not mentioned | New request, today | See §4. There's an important choice about what "production in the cloud" means. |

## 3. The key technical question: one central box, or bridges near the speakers?

The handoff's own conclusion was: *"The main technical risk is not CPU or RAM. It is running 10 simultaneous Bluetooth A2DP streams in close physical proximity."* I agree.

These are the specific risks to check **before buying 10 of anything**:

| Risk | Why it matters | How we reduce it |
|---|---|---|
| **Range from one spot** | Bluetooth is designed for about 10 m in open air. Walls, and especially floors, cut that sharply. A speaker upstairs or at the far end of the house may drop out, however good the adapter. | Needs your speaker locations (Q-A below). Far speakers get a bridge. |
| **USB bandwidth through the hub** | Bluetooth adapters are *full-speed* USB devices. Behind a USB 2/3 hub, full-speed devices share the hub's "transaction translator". A cheap **single-TT hub squeezes all 10 adapters into one 12 Mbit/s channel**. | Buy a **multi-TT** powered hub (I'll shortlist verified models), or split the adapters over two hubs. |
| **USB 3 radio noise** | USB 3 ports and cables leak noise into the 2.4 GHz band Bluetooth uses. The SSD sits on USB 3, right next to the adapters. | Put the adapters on short extension cables, away from the SSD, the SSD cable and the Pi's USB 3 ports. |
| **10 radios in one spot** | Radios near each other raise packet loss (2.4 GHz congestion). | Space them out with extension cables; wire the Pi (no Wi-Fi). |
| **Identical adapters** | With 10 identical adapters, Linux may renumber them (hci0…hci9) after a reboot. Some cheap clones may even share one Bluetooth address (unverified). | **Fixed today:** each speaker can be tied to its adapter's own address instead of hciN. Check for clones with `pair-speaker.sh adapters` on arrival. |
| **Speakers reconnecting to old sources** | A speaker may reconnect to an old MP3 player or phone instead of the Pi. | Forget the speaker on the old devices (documented). |

**Recommendation (for discussion):** don't pick blindly. Run a **pilot**.

1. Buy the central parts first: Pi, 500 GB SSD, multi-TT powered hub, **3 adapters**.
2. Put the Pi where the central box would live. Test the 3 speakers that are **furthest away / upstairs**, for an evening of continuous play.
3. If all 3 are solid, the central design (handoff) is confirmed: buy the other 7 adapters. If some drop out, those speakers get a small bridge (hybrid). Nothing is wasted, because the same Pi becomes the hub.

## 4. Demo and production on one Render app

This is possible, and I'd like to confirm what you mean first.

**The addresses.** `demo.<name>` and `app.<name>` need **a domain name you own** (for example `yourname.com`). Render's own `onrender.com` addresses can't have their own sub-subdomains. With your domain, one Render service can answer both addresses and show the demo on one and the real app on the other. Render supports custom domains, including on the free plan.

**What "production" can mean.** The speakers are in your house, on Bluetooth. Something *in the house* must always hold the Bluetooth connections, so there are two options:

| | **Option 1 (recommended): hub at home, public address via a secure tunnel** | Option 2: hub in the cloud (Render), the home Pi connects out to it |
|---|---|---|
| How | The Pi runs everything. `app.<domain>` reaches it through a free secure tunnel (Cloudflare Tunnel), with a login. | The cloud hub holds the library and queues. The home Pi keeps only Bluetooth and plays what the cloud streams to it. |
| Music library (500 GB) | On the SSD at home | Must live in the cloud: a Render disk costs about **$125/month for 500 GB** (at $0.25/GB), plus a paid always-on plan |
| If your internet goes down | Music keeps playing; the app still works inside the house | **All music stops** |
| YouTube Music | Works (home internet address) | Often blocked: YouTube blocks most cloud-server addresses |
| Monthly cost | $0 | about $130+ |
| Demo on Render | Stays as is, moves to `demo.<domain>` | Same service |

With Option 1, the Render service hosts the demo and can also host a small **landing page** at `app.<domain>` that forwards to the tunnel. Or the tunnel can take `app.<domain>` directly. Either way it's one domain and two addresses.

## 5. Proposed shopping lists (prices approximate, September 2026; to verify at order time)

Raspberry Pi prices rose in 2025–2026 with memory costs. The handoff's "$60–100" for a Pi 4 4 GB is probably now about $85+.

**A. Central box (handoff design), 10 speakers**

| Item | Est. |
|---|---|
| Raspberry Pi 4 4 GB (or Pi 5 4 GB, ~$110: faster, better USB) | ~$85 |
| 500 GB SSD (portable, or SATA + USB 3 case) | $50–70 |
| 10 × TP-Link UB500 (Realtek RTL8761B, works out of the box on Pi OS) | ~$130 |
| Powered **multi-TT** USB hub, 10–16 ports, own power supply | $60–110 |
| 10 × short USB extension cables (spacing) | ~$15 |
| Pi power supply, cooled case, 32 GB microSD | ~$40 |
| **Total** | **~$380–470** |

**B. Bridge per speaker** (my earlier design): hub about $180 with a 500 GB SSD, plus about $68 per speaker. That's about $590 for 6 speakers or $860 for 10. It's the most robust over distance and floors.

**C. Hybrid** (likely outcome of the pilot): list A, minus one adapter for each far speaker, plus one bridge (~$68) for each far speaker.

---

## Questions to settle, in order

**Round 2 (current), after your answers:**

| # | Question |
|---|---|
| R1 | **Library storage: S1, S2 or S3?** (§6) Roughly how much music is on the MP3 players today (GB or number of songs)? |
| R2 | **Domain:** do you own one to use for `demo.` / `app.`? If not, I'd suggest buying one (~$10–15/year). |
| R3 | OK to move the Render service to the **paid Starter plan (~$7/month)** once the real hub goes live? |
| R4 | Where would the Pi sit? Near the middle of the house or the stairwell? Is **5 GHz Wi-Fi** strong there? |
| R5 | **Login** for `app.<domain>`: one password for the household, or separate logins per person? |
| R6 | **YouTube Music:** keep it, with the Pi fetching the audio from your home internet (§6)? |
| R7 | OK to start with the **3-adapter pilot** (§3), testing the farthest upstairs and downstairs spots? |
| R8 | The speakers themselves: models, and mains or battery powered? |

**Round 1 (partly answered: Q-B, Q-C, Q-H are covered above):**

| # | Question |
|---|---|
| Q-A | **Speaker map:** for each speaker, which room and floor is it in, roughly how far (metres) and through how many walls or floors is it from where the central box would sit? Is each one mains or battery powered? (A rough sketch or list is enough.) |
| Q-B | **6 or 10 speakers** (D1)? |
| Q-C | Where would the central box sit? Is there Ethernet there? |
| Q-D | OK to start with the **3-adapter pilot** (§3) before buying everything? |
| Q-E | 500 GB SSD: confirmed (D4)? Roughly how much music is on the MP3 players today (GB or number of songs)? |
| Q-F | YouTube Music: keep as an optional add-on (D5)? |
| Q-G | Is the existing whole-home system still relevant (D6)? If yes: brand/model, and the upstairs setup. |
| Q-H | Demo/production (§4): which **domain** should we use, and **Option 1 or 2**? |
| Q-I | Budget ceiling? |
