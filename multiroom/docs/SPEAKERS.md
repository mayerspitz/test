# Your speakers: setup notes

Every speaker you add uses **one USB Bluetooth adapter**. Add them in the app: Settings → Add a speaker.

| Speaker | Works? | Notes |
|---|---|---|
| **Sony stereo receiver** (looks like **STR-DH190**; please confirm the model on its back label) | ✅ Yes (Bluetooth input) | Counts as **one speaker in the app**. Its A/B speaker outputs both play what the app sends. Mains powered, so it's always available. |
| **BolaButty X-GO C27-C** (Bluetooth 5.3, battery) | ✅ Yes | Battery powered: keep it on its USB-C charger when you can. Don't use its TWS mode (pairing two X-GOs together); each speaker should be its own speaker in the app. |

## Sony receiver (STR-DH190)

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
