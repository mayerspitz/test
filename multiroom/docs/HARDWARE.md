# Hardware guide

> **Superseded for your home.** This describes the earlier design with a small Pi next to each speaker. The chosen setup is one central Pi with the app in the cloud: see [SETUP_CLOUD.md](SETUP_CLOUD.md), [SHOPPING_LIST.md](SHOPPING_LIST.md) and [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md). The volume section below still applies.

**Goal:** up to 6 Bluetooth speakers, each playing its own music. Everything is controlled from a web app on your phone. The app sets volume on the stream only; each speaker's own volume stays exactly where you left it.

## The short answer

| Role | Recommended | Why |
|---|---|---|
| **Hub** (1×) | Raspberry Pi 5 (2 GB is enough) with a USB SSD, **or** any always-on PC/mini PC/NAS you already own | Runs the app, the music library and YouTube Music. Needs no Bluetooth. |
| **Speaker bridge** (1 per speaker) | **Raspberry Pi 4 Model B (1 GB)** + official PSU + case + 16–32 GB microSD + **TP-Link UB500** USB Bluetooth adapter | Sits 1–5 m from its speaker. It receives music from the hub over the network and sends it to the speaker over Bluetooth. |
| Budget bridge | Raspberry Pi 3 Model A+ (dual-band Wi-Fi, BT 4.2, in production until at least 2030) | Cheaper and smaller. Its single USB port can take the UB500. |

Everything is off-the-shelf, with no soldering. Assembly per bridge means putting the Pi in a case, flashing a microSD card with Raspberry Pi Imager, plugging in the USB Bluetooth adapter and running one install script.

### Approximate cost (USD, September 2026)

Raspberry Pi prices rose in 2025–2026 because memory got more expensive, so check current prices.

| Item | Qty | Each | Total |
|---|---|---|---|
| Raspberry Pi 4 Model B 1 GB | 6 | ~$35 | ~$210 |
| Official USB-C power supply | 6 | ~$8 | ~$48 |
| Case | 6 | ~$6 | ~$36 |
| microSD 16–32 GB (A1/A2) | 6 | ~$7 | ~$42 |
| TP-Link UB500 (RTL8761B) Bluetooth adapter | 6 | ~$13 | ~$78 |
| **Bridges subtotal** | | | **~$414** |
| Hub: Raspberry Pi 5 2 GB + 27 W PSU + case + 128 GB USB SSD | 1 | | ~$130 |
| **Total** | | | **~$545**, or ~$414 if you reuse a computer as the hub |

With Pi 3 A+ bridges, the bridge subtotal drops to roughly $270–350.

## Why one bridge per speaker (and not one box with six Bluetooth radios)

The architecture puts the Bluetooth link as close to each speaker as possible. Distance is carried over Wi-Fi or Ethernet, which handles it much better than Bluetooth.

```
                 Wi-Fi / Ethernet (your home network)
  Phone ──► HUB ─────────────┬──────────────┬──────────────┬─── …
  web app   library          │              │              │
            YouTube Music    ▼              ▼              ▼
                           Bridge         Bridge         Bridge      (Raspberry Pi each)
                             │ BT 1–5 m     │ BT           │ BT
                             ▼              ▼              ▼
                          Kitchen        Patio        Upstairs bedroom   (your speakers)
```

A single box with six USB Bluetooth adapters is tempting, but it fails in a real house:

- **Range.** Bluetooth is designed for about 10 m in open air. Walls and especially floors cut that sharply, so speakers upstairs or at the far end of the house drop out.
- **Congestion.** Six Bluetooth radios in one spot, plus Wi-Fi, all share the crowded 2.4 GHz band. The result is stutter.
- **Capacity.** One adapter reliably carries about 2–3 high-quality A2DP streams, so the box would need several adapters on extension cables anyway.

**Hybrid is fine.** A speaker within a few metres of the hub can be driven by the hub itself: plug a UB500 into the hub and run the same bridge installer there, once per adapter. The software is identical either way.

## Why a USB Bluetooth adapter on each Pi

The Pi's built-in Bluetooth shares one radio and antenna with its Wi-Fi. Stutter from that sharing is a long-standing open issue on Pi 3 and Pi Zero 2 W ([raspberrypi/linux#1402](https://github.com/raspberrypi/linux/issues/1402), [#5293](https://github.com/raspberrypi/linux/issues/5293)).

The fix is:

1. **Connect the bridge over Ethernet or 5 GHz Wi-Fi.** Pi 3 A+, Pi 4 and Pi 5 support 5 GHz; Pi Zero 2 W and Pi 3 B do not, so avoid those.
2. **Use a separate USB Bluetooth adapter.** The TP-Link UB500 (Realtek RTL8761B) works out of the box on Raspberry Pi OS, whose firmware is already included. Put it on a short USB extension cable, away from the Pi's blue USB 3 ports, because USB 3 also leaks 2.4 GHz noise.
3. **Turn off the Pi's built-in Bluetooth** so the USB adapter becomes `hci0` (see [SETUP.md](SETUP.md)).

The long-range UB500 **Plus** and similar "BT 5.3 long range" dongles are reported to pair fine but give unstable audio. Stick with the plain RTL8761B nano adapter.

## Keeping the speaker's volume untouched

Bluetooth has a feature called *absolute volume* (AVRCP). With it, turning the volume down on the source changes the speaker's own volume setting. Most phones and streamers use it.

This system turns it off on every bridge (`deploy/wireplumber/51-multiroom-bluetooth.conf`):

- the bridge never sends a volume command to the speaker;
- the bridge sends full-scale digital audio;
- the volume slider in the app scales the audio inside the player (mpv) before it leaves the Pi.

So set each speaker's own volume once, for example 75–100%. It stays there. The app's slider becomes the only volume control you use.

If the WirePlumber setting is missing, the bridge software notices. It then refuses to touch the audio-server volume and logs a warning, as a safety net.

## Off-the-shelf alternatives, compared

"Off-the-shelf" was a plus but not at the cost of the result, so here is how the options compare:

| Option | Assembly | Independent song per speaker | Speaker volume untouched | YouTube Music | Your own app/API | Verdict |
|---|---|---|---|---|---|---|
| **This design** (Pi bridge per speaker) | Low (case + SD card + script) | ✅ up to 6+ | ✅ guaranteed by config | ✅ built in (yt-dlp) | ✅ full REST/WebSocket API | **Recommended** |
| WiiM Pro/Ultra etc. per speaker, Bluetooth output | None | ✅ | ❌ uses AVRCP: the WiiM changes the speaker's volume | ✅ native (Premium) | ⚠️ limited HTTP API | Fails the volume requirement |
| WiiM Mini | None | ✅ | ❌ same | ❌ no YouTube Music or Cast | ⚠️ | No |
| Arylic Bluetooth transmit mode | None | ✅ | ❓ not documented | ⚠️ varies by model | ⚠️ | Unverified |
| Chromecast/Nest/Echo + Bluetooth pairing | None | ⚠️ one cast session per device | ❌ uses the speaker volume | ✅ | ❌ | No |
| One PC with 6 USB Bluetooth adapters | Low | ✅ | ✅ | ✅ | ✅ | Range problems upstairs |

## Choosing and preparing speakers

- **Mains power beats battery.** Battery speakers switch themselves off and need charging. Many brand apps (JBL Portable, UE/Boom) can disable auto-off. The bridges keep the Bluetooth stream open between songs, which stops some speakers from dozing off.
- **Forget the old connections.** Your speakers probably remember your MP3 players and phones. Switch those off, or "forget" the speaker on them, so the speaker does not reconnect to them instead of its bridge.
- **The old MP3 players are no longer needed.** Their music moves into the hub's library, one collection per player; see [SETUP.md](SETUP.md).

## Network

- **One network for everything is simplest.** The bridges find the hub by its address, so they also work across a second router as long as they can reach the hub's IP.
- **Wired Ethernet for bridges where a cable exists; 5 GHz Wi-Fi otherwise.** The installer turns off Wi-Fi power saving, which causes dropouts on Pis.
- **Control from outside the house:** install [Tailscale](https://tailscale.com) (free for personal use) on the hub and on your phone, then open the hub's Tailscale address. Don't forward ports on your router.
