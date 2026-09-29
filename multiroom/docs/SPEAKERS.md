# Your speakers: setup notes

Every speaker you add uses **one USB Bluetooth adapter**. Add them in the app: Settings → Add a speaker.

| Speaker | Works? | Notes |
|---|---|---|
| **Sony STR-DH190** stereo receiver (confirmed) | ✅ Yes (Bluetooth input) | Counts as **one speaker in the app**. Its A/B speaker outputs both play what the app sends. Mains powered, so it's always available. |
| **BolaButty X-GO C27-C** (Bluetooth 5.3, battery) | ✅ Yes | Battery powered: keep it on its USB-C charger when you can. Don't use its TWS mode (pairing two X-GOs together); each speaker should be its own speaker in the app. |

## Sony STR-DH190: can it play different songs in different rooms?

**No, but your new system can give you that.** The STR-DH190 is a single-zone stereo receiver. It has one amplifier and one source at a time. The **SPEAKERS A / B** button only chooses *which* wired speakers play (A, B, or A+B); both always play the *same* song. There is no "Zone 2". (Sony's manual: "connect additional B speakers to enjoy audio in another location… select which speakers to use with the SPEAKERS A/B button"; [manual p. 13](https://www.manualslib.com/manual/1348935/Sony-Str-Dh190.html?page=13), [full manual](https://www.hifiengine.com/manual_library/sony/str-dh190.shtml).) The previous owner most likely had A and B in two rooms, playing the same music.

**How to use it with the app:**
- **As is (recommended to start):** the receiver is one speaker in the app, "Living room (Sony)". Whatever the app sends plays on A, B or A+B, as set by the receiver's SPEAKERS button.
- **To make room B independent (optional, ≈ $60–100):** disconnect room B's speaker wires from the receiver's **B** terminals and connect them to a small **Bluetooth amplifier** instead (e.g. a Fosi Audio BT20A-class amp). Then room B becomes its own speaker in the app with its own songs, and the Sony keeps room A. Same wires, same speakers, just a second amp. First check which rooms A and B actually feed: switch SPEAKERS to A only, then B only, and walk around.

## Sony receiver (STR-DH190): setup

1. **Pairing:** press **BLUETOOTH** on the receiver (or its remote). The display shows "PAIRING" (hold the button if it only switches input). Then, in the app: Search → tap the receiver.
2. **Turn on Bluetooth Standby** in the receiver's menu. It lets the Pi wake the receiver and switch it to the Bluetooth input automatically. It may be off by default.
3. **Volume:** set the receiver's volume knob once to a comfortable maximum, e.g. the level you'd normally use for loud music. From then on, use only the app's slider. The system never changes the receiver's own volume.
4. It's one zone: SPEAKERS A/B chooses which of its wired speaker pairs play, but both get the same song.
5. **Optional, a wired connection:** the receiver's PORTABLE IN / analog input can be fed by cable instead of Bluetooth. The Pi 5 has no headphone jack, so that would need a small USB audio adapter. It's not needed now; Bluetooth is simpler.

## BolaButty X-GO C27-C

1. **Pairing:** turn it on and press its **Bluetooth / pairing** button until the light flashes quickly. Then, in the app: Search → tap "X-GO" (or similar).
2. **Before pairing,** switch Bluetooth off on the phone or MP3 player it used before. Otherwise it may reconnect to that device instead.
3. **Auto-off:** battery speakers switch off when idle. The Pi keeps the Bluetooth link open while it's connected, which helps. When the speaker has been off, just turn it on: the Pi reconnects within about a minute, and the app shows "Speaker connected".
4. **Volume:** turn the speaker's own volume up once (near max). The app does the rest.

## Adding more speakers later
Any speaker that works with a phone over Bluetooth works here. The only exception is rare new models that support *only* "LE Audio / Auracast". Buy one more UB500 adapter (~$13) per extra speaker.
