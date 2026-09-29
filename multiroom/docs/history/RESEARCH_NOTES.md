# Research notes: verified technical facts

These facts were gathered during the first session (2026-09-28/29) and shaped the design. Sources marked [snippet] were seen only in search summaries. Re-check anything price- or version-sensitive before relying on it.

## Volume: keeping the speaker's own volume untouched

**PipeWire / WirePlumber 0.5**
- `bluez5.enable-hw-volume = false` goes in `monitor.bluez.properties`.
- `bluez5.hw-volume = [ ]` is a **per-device** property, so it must go in `monitor.bluez.rules` → `update-props`, matched on `device.name = "~bluez_card.*"`. Inside `monitor.bluez.properties` it is **silently ignored**. Use both settings.
- In the code, hardware volume to speakers is **on by default** (PipeWire 0.3.65 → 1.4.x), whatever the docs say.
- Naming conventions:
  - In `hw-volume` and `auto-connect`, the host → speaker role is named `a2dp_sink` (the name describes the remote device).
  - `bluez5.roles` uses the **opposite** convention.
- `session.suspend-timeout-seconds = 0` (node rule on `bluez_output.*`) means never suspend.
- On a headless Pi, set `monitor.bluez.seat-monitoring = disabled` or use lingering. Otherwise WirePlumber ignores Bluetooth outside an active seat.
- Versions:
  - Raspberry Pi OS Trixie: PipeWire 1.4.2 and WirePlumber 0.5.8, configured in `~/.config/wireplumber/wireplumber.conf.d/*.conf`.
  - Bookworm stock: WirePlumber 0.4 (Lua config); a Lua variant is kept in `deploy/`.
  - Sources: [wireplumber bluetooth.rst](https://github.com/PipeWire/wireplumber/blob/master/docs/rst/daemon/configuration/bluetooth.rst), [pipewire-props](https://github.com/PipeWire/pipewire/blob/master/doc/dox/config/pipewire-props.7.md), [bluez5-dbus.c](https://github.com/PipeWire/pipewire/blob/master/spa/plugins/bluez5/bluez5-dbus.c).

**mpv**
- `--volume` is always software volume, on a cubic curve (`gain = (v/100)^3`).
- Don't use `ao-volume`: it changes the sink-input volume instead.
- The sink is `pulse/bluez_output.AA_BB_CC_DD_EE_FF.1`.
- Source: [mpv audio.c](https://github.com/mpv-player/mpv/blob/master/player/audio.c).

**bluez-alsa (not used)**
- v4 defaults to software volume.
- v5.0 (Aug 2026) flipped the default to native volume.

**WiiM streamers**
- They change the speaker's volume over AVRCP [snippet], and send to one Bluetooth speaker at a time.
- So they're rejected: they break the volume rule.

## Bluetooth hardware

- **TP-Link UB500:**
  - USB ID `2357:0604`, Realtek RTL8761BU.
  - Works on Raspberry Pi OS out of the box (`firmware-realtek`).
  - All revisions, including the "5.4" v3, use the same chip on Linux.
  - Check with `lsusb`; return any unit with a different ID.
- **Long-range "Plus" adapters** (UB500 Plus, ZEXMTE 5.3) gave **unstable A2DP** in a community multi-speaker project. A plain nano adapter on an extension cable is better.
- **Alternatives with the same chip:** ASUS USB-BT500, UGREEN CM390, EDUP EP-B3536.
- **Built-in Pi radio:**
  - It stutters with Wi-Fi active (raspberrypi/linux #1402).
  - It's disabled with `dtoverlay=disable-bt`, and the software also skips it.
- **Identical adapters:** hciN numbering can change between boots, so adapters are chosen by their Bluetooth address.
- **USB hub:** Plugable USB3-HUB10C2 uses VIA VL812 chips. **Not verified** whether each port gets its own transaction translator (multi-TT). The pilot checks with `lsusb -v | grep -i TT`. Fallback: a second hub on the Pi's other USB port.
- **Samsung T7:**
  - Known UAS issue on Pis. Fix: `usb-storage.quirks=04e8:4001:u` in `cmdline.txt` (`auto-setup.sh` adds it).
  - Plug the SSD into the Pi directly, not into the Bluetooth hub.
- **Pi prices (April 2026):** Pi 5 4 GB is about $110; Pi 4 4 GB is about $100. The Pi 5 has two USB controllers, so the SSD and the hub don't share one.

## YouTube

- yt-dlp needs a JavaScript runtime since 2025.11. **Deno ≥ 2.3** is the default. Use the official binary and update it daily.
- YouTube blocks most cloud servers, so the **Pi at home** does the fetching.
- YouTube Music Premium allows **one stream at a time per account** (Family: 6), so the Pi stays signed out.
- `music.youtube.com/search` URLs and playlists work with `--flat-playlist -J`.

## "Different song per room": what actually allows it

- **Sony STR-DH190:**
  - Single zone.
  - SPEAKERS A/B only selects which speakers play, and both get the same source.
  - Sources: [manual p.13](https://www.manualslib.com/manual/1348935/Sony-Str-Dh190.html?page=13), [full manual](https://www.hifiengine.com/manual_library/sony/str-dh190.shtml).
- **Zone-2 receivers** (Denon/HEOS, Yamaha MusicCast):
  - Network, USB and Bluetooth sources are shared between the zones.
  - Only a separate physical input plays independently.
  - They have one Bluetooth input, so they're not a fix here.
  - Sources: [Yamaha manual](https://manual.yamaha.com/av/18/rxa880/en-US/3836060427.html), [AVS forum](https://www.avsforum.com/threads/can-heos-do-multi-zone-within-the-denon-avr-x6300h.2777417/).
- **Matrix amps** (Russound MCA-66, Monoprice 6-zone): as many independent songs as physical sources.
- **AirPlay from one phone, Alexa/Google groups:** the same audio everywhere.
- **Sonos:** rooms are independent unless grouped.
- **Conclusion:** in this system, **one Bluetooth amp or speaker = one independent room**.
- **Fosi Audio BT20A Pro:**
  - TPA3255, 300 W × 2 at 4 Ω; handles 2–8 Ω speakers.
  - Bluetooth 5.0 (SBC/AAC), about 50 ft range; RCA input.
  - Sources: [Fosi](https://fosiaudio.com/products/bt20a-pro-2-channel-bluetooth-power-amplifier), [manual](https://fosiaudio.com/pages/user-instruction-bt20a-pro).

## Network scanner probes (tools/discover-audio-systems.js)

- **Sonos:**
  - SOAP `:1400/ZoneGroupTopology/Control`.
  - It returns 403 when the S2 app's UPnP toggle is off.
- **HEOS:** telnet port 1255.
- **Yamaha:** `/YamahaExtendedControl/v1/system/getFeatures`.
- **BluOS:** `:11000/SyncStatus`.
- **LinkPlay/WiiM:**
  - `/httpapi.asp?command=getStatusEx`.
  - Current firmware serves it over HTTPS on 443 or 4443.
- **Bose SoundTouch:** `:8090/info`. The cloud shut down on 2026-05-06; the local API still works.
- **Russound RIO:** TCP port 9621.
