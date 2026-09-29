# Your speakers: setup notes

Every speaker you add uses **one USB Bluetooth adapter**. Add them in the app: Settings → Add a speaker.

| Speaker | Works? | Notes |
|---|---|---|
| **Sony STR-DH190** stereo receiver (confirmed) | ✅ Yes (Bluetooth input) | Counts as **one speaker in the app**. Its A/B speaker outputs both play what the app sends. Mains powered, so it's always available. |
| **BolaButty X-GO C27-C** (Bluetooth 5.3, battery) | ✅ Yes | Battery powered: keep it on its USB-C charger when you can. Don't use its TWS mode (pairing two X-GOs together); each speaker should be its own speaker in the app. |

## Sony STR-DH190: can it play different songs in different rooms?

**No, but your new system can give you that.** The STR-DH190 is a single-zone stereo receiver. It has one amplifier and one source at a time. The **SPEAKERS A / B** button only chooses *which* wired speakers play (A, B, or A+B); both always play the *same* song. There is no "Zone 2". (Sony's manual: "connect additional B speakers to enjoy audio in another location… select which speakers to use with the SPEAKERS A/B button"; [manual p. 13](https://www.manualslib.com/manual/1348935/Sony-Str-Dh190.html?page=13), [full manual](https://www.hifiengine.com/manual_library/sony/str-dh190.shtml).) The previous owner most likely had A and B in two rooms, playing the same music.

## Getting separate rooms (the plan)

**The rule:** in this system, **one amplifier = one independent room**. The Pi sends a separate stream to each Bluetooth device, so every room that needs its own song needs its own Bluetooth-connected amp or speaker.

**Why not a new multi-zone receiver instead?** Receivers with "Zone 2" (Denon, Yamaha, Onkyo) cost $500+, give you only 2 zones, and still have **one** Bluetooth input. The Pi could only send one stream to them, so Zone 2 couldn't play a different song from the app. It doesn't fix the problem.

**Recommended: keep the Sony for one room, add a small Bluetooth amp for each other wired room.**

| Room | Plays through | In the app |
|---|---|---|
| Room A (e.g. living room) | Sony STR-DH190, SPEAKERS set to **A** | "Living room (Sony)" |
| Room B | New Bluetooth amp (Fosi Audio BT20A Pro), room B's existing speaker wires | "Room B" |
| Each more wired room | One more Bluetooth amp | its own speaker |

Same in-wall/ceiling speakers, same wires. Only the amp that drives them changes. Each amp costs about $70–100 and needs one UB500 adapter in the Pi, like any other speaker.

**Step by step:**
1. **Find out what A and B feed.** On the Sony, set SPEAKERS to **A** only, play something, and walk around. Then **B** only. Note which rooms play. If the receiver's back has more than two wire pairs, or there's a speaker selector box, each pair is a room: count them.
2. **Check the speakers' impedance** (label on the back of a speaker, or the wall plate). 4–8 Ω is the normal case and fine for the BT20A Pro.
3. **Buy one Bluetooth amp per room beyond room A** (shopping list item 12).
4. **Rewire (unplugged, 5 minutes):** turn the Sony off. Take room B's two wire pairs (left + and −, right + and −) off the Sony's **B** terminals and screw them into the amp's speaker posts, keeping + to + and − to −. Set the Sony's SPEAKERS button to **A**. Place the amp next to the Sony and plug in its power supply.
5. **Amp settings:** set its volume knob about ¾ of the way up and bass/treble to the middle, then leave them. Put it in **Bluetooth** input mode.
6. **Add it in the app:** Settings → Add a speaker → Search. The amp appears as e.g. "Fosi Audio BT20A". Name it after the room.
7. **Test:** play a different song on "Living room (Sony)" and on the new room at the same time.

**Alternative: retire the Sony.** Use one Bluetooth amp per room for every room, room A included. Do this only if the Sony gives trouble (for example it drops out of Bluetooth standby). Keeping it saves one amp.

## Sony receiver (STR-DH190): setup

1. **Pairing:** press **BLUETOOTH** on the receiver (or its remote). The display shows "PAIRING" (hold the button if it only switches input). Then, in the app: Search → tap the receiver.
2. **Turn on Bluetooth Standby** in the receiver's menu. It lets the Pi wake the receiver and switch it to the Bluetooth input automatically. It may be off by default.
3. **Volume:** set the receiver's volume knob once to a comfortable maximum, e.g. the level you'd normally use for loud music. From then on, use only the app's slider. The system never changes the receiver's own volume.
4. It's one zone: once room B moves to its own amp, leave SPEAKERS on **A**.
5. **Optional, a wired connection:** the receiver's PORTABLE IN / analog input can be fed by cable instead of Bluetooth. The Pi 5 has no headphone jack, so that would need a small USB audio adapter. It's not needed now; Bluetooth is simpler.

## BolaButty X-GO C27-C

1. **Pairing:** turn it on and press its **Bluetooth / pairing** button until the light flashes quickly. Then, in the app: Search → tap "X-GO" (or similar).
2. **Before pairing,** switch Bluetooth off on the phone or MP3 player it used before. Otherwise it may reconnect to that device instead.
3. **Auto-off:** battery speakers switch off when idle. The Pi keeps the Bluetooth link open while it's connected, which helps. When the speaker has been off, just turn it on: the Pi reconnects within about a minute, and the app shows "Speaker connected".
4. **Volume:** turn the speaker's own volume up once (near max). The app does the rest.

## Adding more speakers later
Any speaker that works with a phone over Bluetooth works here. The only exception is rare new models that support *only* "LE Audio / Auracast". Buy one more UB500 adapter (~$13) per extra speaker.
