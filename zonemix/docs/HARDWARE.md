# ZoneMix hardware

Nothing needs to be bought yet. These lists are for when you decide.

**Prices** are approximate US retail as of September 2026. Most come from search results, because the sandbox could not open retailer sites, so check them before ordering. **(est.)** marks my own estimate. Speakers, amplifiers and the mixer's normal cabling are not included.

## 1. Mixer

ZoneMix needs one mix bus per zone, plus whatever the stage monitors use. The first supported family is Behringer X32 / Midas M32 and X Air, chosen for their open, documented network control (OSC).

| Mixer | Mix buses | Input channels | Approx. price | Notes |
|---|---|---|---|---|
| Behringer XR18 / Midas MR18 | 6 | 16 + aux | $509 | 3–4 zones + 2 monitor mixes. Cheapest way to start. |
| Behringer X32 Rack | 16 | 32 | $989 | Recommended: room for 8+ zones and monitors. |
| Behringer X32 Compact | 16 | 32 | $1,649 | Same engine as the Rack, with faders. |
| Midas M32R Live | 16 | 32 | about $3,300 | Same protocol as the X32. |
| Behringer WING Rack | 16 | 48 | from about $1,285 | Has its own OSC protocol; driver planned for Phase 4. |

**If you already own a digital mixer, tell me which (question P1).** Allen & Heath and Yamaha consoles also have remote-control protocols, so a driver for yours may be quicker than buying a new mixer.

## 2. Pilot kit (Phase 1): prove it at a real event for about $280

This uses your mixer and laptop, plus plain wired measurement mics plugged into spare mixer inputs. No custom electronics. The controller reads each mic's level from the mixer's meters.

| Item | Product | Qty | Unit | Total |
|---|---|---|---|---|
| Measurement mic | Behringer ECM8000 | 3 | $25.90 | $78 |
| Mic cables to reach the zones | XLR, 20–30 m | 3 | ~$15 (est.) | $45 |
| Acoustic calibrator (sets the mics' dB exactly) | Class 2, 94/114 dB, e.g. SC-05 | 1 | ~$155 | $155 |
| Controller | Your laptop | 1 | — | $0 |
| **Total** | | | | **≈ $280** |

**Limits of the pilot kit:**
- Each measurement mic takes a mixer input.
- The mixer's meters are unweighted rather than dB(A); a channel low-cut filter gets close enough for a pilot.
- The mic cables need to run across the venue.

The Phase 2 sensors remove all three.

## 3. Event kit (Phase 2 onward): 5 zones, about $1,250

| Item | Product | Qty | Unit | Total |
|---|---|---|---|---|
| Sensor board | Olimex ESP32-POE-ISO (WROOM version) | 6 (5 + spare) | ~$29 | $174 |
| Sensor microphone | Adafruit ICS-43434 I²S breakout (#6049) | 6 | $8.95 | $54 |
| Enclosure, foam windscreen, stand/clamp mount, cable gland | 3D-printed + parts | 6 | ~$12 (est.) | $72 |
| PoE+ switch | TP-Link TL-SG1210P (8 PoE+ ports, 63 W) | 1 | ~$100 (est.) | $100 |
| Wi-Fi access point, for the operator's phone | Ubiquiti U6+ | 1 | $129 | $129 |
| Controller | Intel N100 mini PC, 16 GB / 512 GB (e.g. Beelink S12 Pro) | 1 | $290–400 | ~$320 |
| Acoustic calibrator | Class 2, 94/114 dB | 1 | ~$155 | $155 |
| Network cables | Cat6, 30 m, pre-made | 6 | ~$15 (est.) | $90 |
| UPS for controller, switch and AP | 600 VA | 1 | ~$80 (est.) | $80 |
| Carry case / small rack | — | 1 | ~$60 (est.) | $60 |
| **Total** | | | | **≈ $1,234** |

Buying notes:
- **Do not buy the TL-SG1008P** for this. Despite the name it has only 4 PoE ports.
- **Mini PC over Raspberry Pi.** A Pi 5 (8 GB) now costs about $200 after memory-driven price rises, before adding a case, power supply and SSD. At that price the N100 mini PC is sturdier, and has an SSD and a metal case.
- **Scaling.** Each extra zone costs about $65 in sensor parts and cable. Past 8 sensors, a bigger PoE switch.

## 4. Sensor node build

**Wiring**, ICS-43434 breakout to ESP32-POE-ISO. Pins are chosen from the board's free GPIOs; confirm against the board schematic when building.

| Mic pin | ESP32-POE-ISO | |
|---|---|---|
| 3V | 3.3V | |
| GND | GND | |
| BCLK | GPIO 32 | I²S bit clock |
| LRCL (WS) | GPIO 33 | I²S word select |
| DOUT | GPIO 36 | Input-only pin, fine for data in |
| SEL | GND | Left channel |

**Enclosure:**
- A small 3D-printed box.
- The mic port faces up or forward, with a foam windscreen.
- A threaded insert for a mic stand (5/8") or a clamp.
- A cable gland for the Cat6.
- A status LED visible from outside: green means sending, blinking means no network.

**Firmware (Phase 2):**
- I²S capture at 48 kHz.
- A- and C-weighting filters plus the mic's correction EQ.
- Leq every 125 ms, peak level.
- UDP broadcast.
- A small web page for the sensor ID and calibration offset.
- Updates over the network.

The open-source [esp32-i2s-slm](https://github.com/ikostoski/esp32-i2s-slm) project already does the measurement part for this microphone.

**Range.** The ICS-43434 overloads at 120 dB SPL. That is fine in listening areas, including a dance floor at 100 dB(A), but do not place a sensor right in front of a PA stack.

## 5. Where things go at the venue

```
  [stage / main PA]──────────── dance floor ─── sensor on a stand at 1.6 m, ~6 m out
        │
  mixer + controller + PoE switch + AP (front of house)
        │  Cat6 (data + power) to each sensor
        ├── dining left  ── sensor at 1.2 m (seated ear height), mid-zone, ≥ 3 m from fills
        ├── dining right ── sensor likewise
        ├── bar          ── sensor on a pillar at 1.6 m, away from the coffee machine
        └── foyer        ── sensor on a stand, not in the doorway draught
```
