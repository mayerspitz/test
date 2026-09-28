# Verifying your current whole-home system

This guide answers two questions:

1. **Can each room really play a *different* song at the same time?**
2. **Does upstairs have the same ability?** It may not, even with the same brand of equipment.

It takes about 30 minutes: a network scan, then a hands-on listening test that gives the definitive answer. It is safe. Nothing here changes your system's settings, and the scanner only reads.

> **Fastest path:** send me the brand and model of your system (the app you use, the keypads, or the labels on the boxes in the equipment closet). Also say whether upstairs has its own router or extender. Paste the scanner output too if you can. I'll interpret it for your exact setup.

---

## Step 1 — Identify what you have (5 min)

Write down:

- **The app** you use to choose music per room: Sonos, HEOS, MusicCast, BluOS, WiiM Home, Google Home, Alexa, Control4, Crestron, Savant, Russound, Nuvo, or something else.
- **Wall keypads** (if any): the brand is usually printed on them or under the faceplate.
- **The equipment closet or rack.** Photograph the front and back label of every audio box: amplifiers with many speaker terminals, streamers, AV receivers. For each speaker-wire bundle, note **which box and which output it goes into**. In particular: do the upstairs rooms go into the **same box** as downstairs, a **different box**, or a **"Zone 2/Zone 3" output** of an AV receiver?
- **Network:** is it one mesh Wi-Fi system, or is there a second router or extender upstairs? Is there a different Wi-Fi name upstairs?

## Step 2 — Scan the network, downstairs and upstairs (5 min)

On a laptop with [Node.js](https://nodejs.org) installed (no other setup needed):

```bash
cd test/multiroom
node tools/discover-audio-systems.js
```

The scanner finds Sonos, Denon/Marantz HEOS, Yamaha MusicCast, Bluesound/BluOS, WiiM/LinkPlay, Bose SoundTouch, Google Cast/Nest, AirPlay, Alexa and common controller brands (Control4, Crestron, Savant, Russound, Nuvo…). Where the device allows it, it also **asks each system how its rooms and zones are set up**:

- Sonos rooms and current groups
- HEOS players
- MusicCast zones and which inputs are shared
- BluOS and WiiM groups

For each system it prints a verdict: **YES / NO / PARTLY / UNKNOWN**.

Then compare the floors:

```bash
# connected to the downstairs Wi-Fi
node tools/discover-audio-systems.js --label downstairs --json > downstairs.json
# walk upstairs; if the upstairs Wi-Fi has a different name, join it
node tools/discover-audio-systems.js --label upstairs --json > upstairs.json
node tools/discover-audio-systems.js --compare downstairs.json upstairs.json
```

The comparison tells you whether the two floors are on **different subnets**, which means separate network infrastructure. It also lists which devices are visible from only one floor.

If the system is a wired matrix amplifier or controller, you can query it directly by IP: `--probe 192.168.1.50`. This works for Russound RIO, HEOS, Sonos, MusicCast, BluOS, LinkPlay and SoundTouch.

## Step 3 — The two-song test (15 min): the definitive answer

Use **the same phone and the same app** you normally use. Pick two songs that are easy to tell apart.

| # | Test | Pass means |
|---|---|---|
| A | Downstairs room 1 plays **Song 1**. Downstairs room 2 plays **Song 2**. Listen for 2 minutes. | Both keep playing their own song. |
| B | In room 1: change the volume, pause, then skip. | Room 2 is not affected at all. |
| C | Downstairs room 1 plays Song 1, **upstairs** room 3 plays **Song 2**. | Same as A. |
| D | Upstairs room 3 plays Song 1, **upstairs** room 4 plays **Song 2**. | Same as A. |
| E | Keep adding rooms, each with a different song, until something breaks. | The count reached = **how many different songs your system can play at once**. |
| F | Repeat A with **the same streaming service** in both rooms (e.g. Spotify + Spotify). Then with **two different services** (Spotify + radio). | Tells a hardware limit apart from an **account limit**. Many individual music plans allow only 1 stream at a time. |

What "something breaks" can look like:

- one room switches to the other room's song
- the app says the source is in use
- a room goes silent
- two rooms' volumes move together
- one room's music pauses when you start another

### Record sheet

| Room | Floor | Box / output it's wired to | Test A/C/D result | Notes |
|---|---|---|---|---|
| | | | | |
| | | | | |

## Step 4 — Interpreting the results

| Your system is… | Different song per room? | Typical catch |
|---|---|---|
| **Networked speakers/amps**: Sonos, HEOS speakers, Bluesound, WiiM, MusicCast speakers, Bose | **Yes.** Each device is independent. | Rooms you *group* share audio. One amp (e.g. a Sonos Amp) feeding several rooms' speakers makes those rooms **one zone**. |
| **AV receiver with Zone 2 / Zone 3**: Denon/Marantz (HEOS), Yamaha (MusicCast), Onkyo, Pioneer… | **Partly.** | The receiver has **one** network/streaming player. Zone 2 can play a *different physical input* (e.g. a separate streamer plugged into it), but **not a second, different streaming song**. |
| **Matrix amplifier**: Russound MCA, Nuvo, Monoprice/Dayton 6-zone, HTD… | **Yes, up to the number of sources.** | 6 zones with 2 streamers connected = **2 different songs** at once. Upstairs on a *separate* amp has its own sources and its own limit. |
| **One amplifier + speaker selector / in-wall volume knobs** | **No.** | All rooms hear the same song; the knobs only change loudness. |
| **AirPlay from one iPhone** | **No.** | Every selected speaker gets the same audio. |
| **Google / Alexa speaker groups** | **No, per group.** | Individual devices can differ, but each needs its own session (different phone or voice command), and account stream limits apply. |

## Why upstairs may behave differently even with "the same device"

These are the usual reasons, most common first:

1. **Upstairs is Zone 2 of the same receiver.** Its streaming source is then shared with the main zone (see above). *Check:* the wiring from Step 1, and whether the app shows upstairs as "Zone 2" of a receiver.
2. **Several upstairs rooms are wired in parallel to one amplifier output.** Installers do this to save channels. Those rooms always play the same thing; wall knobs only attenuate. *Check:* test D fails, and the closet shows one output feeding several rooms.
3. **Upstairs is on a separate network**, such as a second router, an extender in "router mode", or a guest/VLAN network with client isolation. The app can't see or group devices across it, and control may be flaky. *Check:* Step 2's `--compare` reports different subnets, or upstairs devices are missing from the downstairs scan.
   - *Fix:* set the upstairs router or extender to access-point / bridge mode, or use a mesh system.
4. **Different model or generation upstairs.** Examples: Sonos S1-only players can't join an S2 system; an older HEOS or MusicCast device may have different zone features. *Check:* the model list in the scan.
5. **Weak Wi-Fi upstairs.** This causes dropouts, not a missing feature. *Check:* signal strength in the app, or wire the device.
6. **Account limits.** Test F shows whether a "failure" is really your music plan allowing only one stream.

## How this relates to the new system

The new system doesn't depend on any of these. Each Bluetooth speaker gets **its own bridge and its own stream** from the hub, so up to 6 (or more) independent songs play at once, each with its own software volume.

Upstairs bridges only need to reach the hub's address over the network. That works even across a second router, because the bridges connect to the hub directly instead of relying on network discovery.

**Using both systems:** if your existing system turns out to be fully independent per room, some rooms can keep using it, and the new system can cover the Bluetooth speakers. If it is Sonos, HEOS, BluOS or WiiM, the hub could later also send its streams to those players.
